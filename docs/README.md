# HTML Deck Studio · 设计文档

> 把 AI 产出的 HTML 演示稿，变成网页里点哪改哪的可视化制品，一键导出工业级 PPT / PDF。

本目录是产品立项阶段的设计文档集合，供产品、设计、研发、测试在 v1 启动前同步上下文。

## 目录

| 文档 | 角色 | 状态 |
| --- | --- | --- |
| [PRD.md](PRD.md) | 产品需求文档 · 由产品负责人维护 | Draft v0.1 |
| [TRD.md](TRD.md) | 技术方案文档 · 由架构师维护 | Draft v0.1 |
| [GROWTH.md](GROWTH.md) | 增长与运营思路 · 定位/渠道/冷启动/护城河 | Draft v0.1 |
| [ROADMAP.md](ROADMAP.md) | 产品优化建议与路线图 · 优先级分层 | Draft v0.1 |

## 一句话产品定位

**HTML Deck Studio** 是一个纯 Web 工具站：用户在自己的 AI 工具（Cursor / Claude / ChatGPT / Codex 等）中生成 HTML 演示稿，拖入本工具后即可在浏览器内点选元素、所见即所得地微调文字与图片，再一键导出图片型 PPTX / PDF。

> 上游不管 HTML 是怎么来的，下游一定能给出可投影的 PPT/PDF。

## 与其它产品的边界

- 不是 reveal.js / Slidev：不规定主题与模板，只接「已经长好的 HTML」。
- 不是 Canva / Gamma：不做 AI 生成 PPT，也不做版式推荐。
- 不是 PPT 在线编辑器：不输出原生 PPTX 可编辑文本对象，导出形态是每页一张高清图。
- 不是云盘：用户数据始终在本地磁盘，服务端零持久化。

## 关键设计决策（v1）

1. **纯 Web SPA**，不做桌面 App。
2. **File System Access API** 直接读写本地文件夹，AI 工具产物零迁移。
3. **后端无状态**：导出请求结束即销毁临时文件，隐私可承诺。
4. **匿名即用**：v1 不做账号体系，靠 IP 限流 + Stripe Checkout 兑换 license key。
5. **图片型 PPT**：每页一张 2560×1440 PNG，最大限度保留原 HTML 视觉。

## 版本历史

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| v0.1 | 2026-05-28 | 初稿，定义 v1 MVP 范围与技术骨架 |

## 参考资料

- 现有 HTML 演示稿样例：`/Users/zm00107ml/Downloads/figures/bilayer-network-slides.html`
- 现有导出脚本（Python 版，TRD 中迁移到 Node）：`/Users/zm00107ml/Downloads/figures/html_to_pptx.py`
- 现有 PPT 产物：`/Users/zm00107ml/Downloads/figures/bilayer-network-slides.pptx`
