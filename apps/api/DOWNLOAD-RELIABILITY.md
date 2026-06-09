# 导出下载可靠性运维指南

针对线上「导出下载中途失败 / 续传从头重来」问题的完整治理清单。代码侧（断点续传 + 流式 + 可选体积压缩）已落地，本文档补齐**阿里云环境侧**的配套配置，需在服务器上执行/核对。

---

## 0. 代码侧已修复（无需操作，仅说明）

`apps/api/src/routes/export.ts` 的 `downloadHandler` 已重写：

- 响应 `Accept-Ranges: bytes`，解析请求 `Range` 头，命中则返回 `206 Partial Content` + `Content-Range`，配合 `fs.createReadStream(path,{start,end})` 流式切片发送。
- 无 `Range` 时返回 `200` + 精确 `Content-Length`，整文件以 `createReadStream` 流式发送（不再 `fs.readFile` 整读进内存）。
- 这直接修掉「续传从头重来」，并消除大文件内存尖峰 / 背压缺失导致的崩断。

**可选体积压缩**（见 §3）：设环境变量 `EXPORT_IMAGE_FORMAT=jpeg` 即可让导出截图用 JPEG，文件体积约降 3–5×。

---

## 1. 反向代理（Nginx / Caddy）——治「中途失败」

若 ECS 前置了 Nginx 反代，**下载路径**必须关闭缓冲并放大超时，否则反代会把大文件先吞进自己缓冲区，加剧失败、且可能吃掉 `Range`/`206`：

```nginx
location /v1/download/ {
    proxy_pass http://127.0.0.1:3000;

    # 关键：关闭缓冲，让字节流式透传（含 206/Content-Range）
    proxy_buffering off;
    proxy_request_buffering off;

    # 放大超时，避免慢客户端/大文件被空闲超时切断
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;

    # 透传 Range 相关头（默认会传，显式声明更稳）
    proxy_set_header Range $http_range;
    proxy_set_header If-Range $http_if_range;

    # 不缓存导出产物（短期一次性令牌）
    proxy_cache off;

    sendfile on;
}
```

- Caddy：`reverse_proxy` 默认流式透传，确认未配 `flush_interval -1` 之外的缓冲；必要时显式 `flush_interval -1`（即时刷新）。
- SSE 导出进度路径（`/v1/export`）已在代码里设了 `X-Accel-Buffering: no`，无需额外配置。

## 2. CDN / SLB

- 若 `/v1/download/` 子域走了 CDN：**关闭对该路径的缓存与缓冲**，或让下载子域直连源站（CDN 对大文件强缓冲/短超时是常见断点源）。
- 若走 SLB（负载均衡）：确认监听的**连接空闲超时** ≥ 600s，并开启会话保持或确保下载在单连接内完成。

## 3. 出网带宽——「中途失败」的环境放大器

- 在 ECS 控制台查**公网出带宽**峰值。固定带宽常见 1–5 Mbps：
  - 50 MB 文件 @ 5 Mbps ≈ 80s，@ 1 Mbps ≈ 400s，期间任何抖动都可能断。
- 处理：
  1. 先靠 §0 的断点续传兜底（断了能续，不再从 0）。
  2. 若实测仍慢/易断，临时改 **按使用流量计费** 或上调峰值带宽。
  3. 配合 §4 缩小文件，双向减压。

## 4. 缩小导出体积（最实在的减负）

高分辨率档每页嵌 4–5K PNG，文件巨大。已提供零依赖开关：

| 环境变量 | 默认 | 说明 |
| --- | --- | --- |
| `EXPORT_IMAGE_FORMAT` | `png` | 设为 `jpeg` 改用 JPEG 截图，体积约降 3–5× |
| `EXPORT_IMAGE_QUALITY` | `90` | JPEG 质量 1–100（仅 jpeg 生效） |

```bash
# 推荐线上设置（2x+ 超采样下肉眼几乎无差，幻灯片文字仍清晰）
EXPORT_IMAGE_FORMAT=jpeg
EXPORT_IMAGE_QUALITY=90
```

- PPTX / PDF 构建器已按文件扩展名自动识别 png/jpeg 嵌图，无需其它改动。
- 含大量渐变/摄影图的 deck 若对画质敏感，可调高 `EXPORT_IMAGE_QUALITY` 或保持 png。

## 5. 可选治本：下载卸载到阿里云 OSS

ECS 直发受限于其带宽且占用应用进程。最稳的长期解是把产物传到 **OSS**，`done` 事件返回 OSS 签名 URL，浏览器直连 OSS 下载：

- OSS **原生支持 Range/断点续传**、带宽独立于 ECS、稳定且省 ECS 带宽。
- 改动集中在 `export.ts` 产物落地处：把 `cachedPath` 改为上传 OSS，`sse('done', { url: <signedUrl>, filename })`。
- 落地要点：
  - 用 `ali-oss` SDK，`putObject` 上传，`signatureUrl(name,{ expires, response:{ 'content-disposition': ... } })` 生成带下载文件名的签名 URL（默认 TTL 与现 10 分钟令牌对齐）。
  - Bucket 设私有读 + 生命周期规则自动清理临时产物。
  - 凭证用 RAM 子账号 + 环境变量（`OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET` / `OSS_BUCKET` / `OSS_REGION`），不要硬编码。
- 本仓暂未引入 OSS 依赖（避免在缺凭证环境破坏构建）；待提供 Bucket 与 RAM 凭证后再接入。

---

## 6. 验证清单

```bash
# 1. 206 + Content-Range（断点续传生效）
curl -s -D - -o /dev/null -r 0-1000 "https://<host>/v1/download/<token>"
#   期望: HTTP/1.1 206 Partial Content
#        Accept-Ranges: bytes
#        Content-Range: bytes 0-1000/<total>
#        Content-Length: 1001

# 2. 完整下载 + 中断重连不从 0（-C - 续传）
curl -C - -o out.pptx "https://<host>/v1/download/<token>"   # 断网后重跑，应从断点续

# 3. 体积对比（开/关 JPEG）
#   EXPORT_IMAGE_FORMAT=png  vs  jpeg，比较产物大小
```

- 应用启动正常：`pnpm --filter @hds/api start`。
- 导出闭环（截图 → 组装 → 下载）无回归。
