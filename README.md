# HTML Deck Studio

> Trim AI-generated HTML decks in the browser, then export pixel-perfect PPTX / PDF in one click.

HTML Deck Studio 是一个纯 Web 工具站：用户在自己的 AI 工具（Cursor / Claude / ChatGPT / Codex 等）中生成 HTML 演示稿，拖入本工具后即可在浏览器内点选元素、所见即所得地微调文字与图片，再一键导出图片型 PPTX / PDF。

> 上游不管 HTML 是怎么来的，下游一定能给出可投影的 PPT/PDF。

## 仓库结构

```
html-deck-studio/
├── docs/                        # 设计文档（PRD / TRD / 评审基线）
│   ├── README.md                # 文档目录
│   ├── PRD.md                   # 产品需求
│   └── TRD.md                   # 技术方案
├── .gitignore
├── LICENSE                      # MIT
└── README.md                    # 本文件
```

随实现推进将出现：

```
apps/
  web/                           # 前端 SPA (React + Vite)
  api/                           # 无状态导出服务 (Node + Fastify + Puppeteer)
  marketing/                     # 营销站
packages/
  protocol/                      # HDS Slide Protocol 共享类型
  telemetry/                     # OTel / Sentry / PostHog 封装
```

## 开始阅读

1. [docs/README.md](docs/README.md) · 文档导航
2. [docs/PRD.md](docs/PRD.md) · 产品需求（14 章）
3. [docs/TRD.md](docs/TRD.md) · 技术方案（15 章 + 2 附录）

## 里程碑

| 里程碑 | 周期 | 关键交付 |
| --- | --- | --- |
| M1 MVP | 4 周 | Chromium 浏览器内"打开 → 编辑 → 导出 PPTX/PDF"闭环 |
| M2 兜底与示例 | 3 周 | Safari/Firefox ZIP 兜底；示例模板；历史恢复 |
| M3 计费 | 3 周 | Stripe Checkout、匿名免费额度、license key |
| M4 账号与协作 | 6 周 | 可选邮箱账号、云项目库、团队空间 |

## 设计决策（v1）

| 决策 | 结论 |
| --- | --- |
| 部署形态 | 纯 Web SPA + 无状态导出服务 |
| 本地文件读写 | 仅 Chromium 系（File System Access API） |
| PPT 导出形态 | 图片型，每页一张 2560×1440 PNG |
| 用户体系 | v1 匿名即用；M3 起匿名 + license key；M4 起可选账号 |
| Mermaid 支持 | v1 兼容（运行时渲染 + 截图前等待 SVG 完成） |
| 单页导出 | v1 支持（导出抽屉提供页码范围） |
| 自定义调色板 | 不做（保留预设 8 色） |
| 移动端预览 | 不做（提示需桌面端使用） |

## 开发约定

- 包管理：pnpm（待落地）
- TypeScript 严格模式
- Conventional Commits
- 分支策略：trunk-based，feature/* + 自动 preview 部署
- 详情见 [docs/TRD.md](docs/TRD.md) §13 发布与运维

## License

[MIT](LICENSE)
