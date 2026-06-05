<div align="center">

<img src="apps/web/public/logo-mark.svg" alt="NextPPT" width="84" height="84" />

# NextPPT

**下一代 PPT，从 HTML 开始 —— 把 AI 产出的 HTML 演示稿，在浏览器里点哪改哪，一键导出工业级 PPTX / PDF。**

[English](README.md) | 简体中文

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#参与贡献)
![Local-first](https://img.shields.io/badge/本地优先-不上传-blue.svg)
![Open Source](https://img.shields.io/badge/开源-免费-orange.svg)

</div>

> 你的 AI 工具已经能写出很漂亮的 `deck.html`，NextPPT 补的是最后一公里：改一个字不用重开一轮对话，像 PPT 一样拖图层，本地导出能投影的幻灯片。

<div align="center">
  <img src="docs/assets/demo.gif" alt="NextPPT 演示" width="760" />
  <br />
  <sub>演示占位 · 把 <code>demo.gif</code> 放到 <code>docs/assets/</code> 即可</sub>
</div>

## 为什么做这个

「让 AI 用 HTML 写幻灯片」已经是很多人的日常了。Cursor / Claude / ChatGPT 写排版、KaTeX、Mermaid、自定义字体都很强，但原生 PowerPoint 那套 XML 始终很烂。所以大家干脆让 AI 产一个好看的 `deck.html`。

然后每次都会撞上三个问题：

- **临场改一句话太难受。** 答辩前一晚导师说「第 16 页那句话改一下」，你又得回到 AI：发 prompt、等、看 diff、保存。一次还好，第十次真的想骂人。
- **投影还是要 PPT/PDF。** 学校要 `.pptx`，客户要 `.pdf`，HTML 直接上投影仪很容易掉字体、卡网络。
- **隐私是真的焦虑。** 答辩稿、客户方案、内部资料，大家都不太敢传到在线编辑器。

**NextPPT** 只把一件事做好：拿你已经有的 HTML，在浏览器里点哪改哪，再导出高保真 PPT/PDF —— **文件全程不离开你本机。**

它不是 AI 生成 PPT，不是 reveal.js / Slidev 那种要重学语法的工具，也不是云端编辑器。它就是一把专门修剪 AI 演示稿的剪刀。

## 快速开始

```bash
pnpm install
pnpm dev
# 前端 → http://localhost:5173   后端 → http://localhost:3000
```

用 Chromium 内核浏览器（Chrome / Edge / Brave / Arc）：

1. **打开** — 选包含 `deck.html` 和图片的文件夹，拖入单个 `.html`，或在首页点「试用样例」。打开的文件若不是合法演示稿，会给出明确的行内提示并直达指南里的提示词，不会「点了没反应」。
2. **编辑** — **编辑**模式：点文字、右侧面板改字号颜色，双击行内输入。**拖动**模式：拖位置、拖角缩放、调层级（置顶 / 置底、上移 / 下移一层），像 PPT，不用写代码。进入拖动模式会自动提取可拖元素，任何元素第一次就能拖。
3. **导出** — 选 PPTX 或 PDF，最高 5120×2880，支持指定页码。搞定。

改动自动防抖回写磁盘，`.hds-backup/` 里留带时间戳快照，原文件不会被改坏。

第一次用？顶部导航进 **使用指南** — 生成 / 编辑 / 导出三步走，附可一键复制的提示词，中英文随时切换。

## 它是怎么跑的

浏览器 SPA 负责全部编辑；无状态服务只在导出时出现，事后立刻清掉一切。

```mermaid
flowchart LR
  ai["AI 产出 deck.html"] --> open["浏览器打开"]
  open --> edit["编辑 / 拖动 双模式"]
  edit --> save["自动回写 + 备份"]
  edit --> export["一键导出"]
  export --> svc["Puppeteer 截图"]
  svc --> file["PPTX / PDF"]
```

- **编辑**走 File System Access API，读写本地，不上传。
- **导出**高 DPI 逐页截图、拼文件、删临时目录。无数据库、无对象存储。

## 功能

- **点哪改哪。** 任意 `<section class="slide">` 结构都能用；属性面板支持字号、字重、颜色、对齐、装饰、链接、换图。
- **编辑 / 拖动双模式。** 编辑 = 只改字，界面安静；拖动 = 自由移动、缩放、完整层级排序（置顶 / 置底、上移 / 下移一层）。进入拖动模式自动提取可拖元素，不用先「唤醒」某个图层。
- **Mermaid 实时渲染。** 写源码即可预览，导出依旧清晰。
- **高保真导出。** 图片型 PPTX / PDF，和 HTML 长得一样；最高 5120×2880，支持单页/范围。
- **新手引导。** 内置使用指南页串起「生成 → 编辑 → 导出」，附可一键复制的 AI 提示词；打开格式不对的文件会给出行内提示并引导到指南，而不是默默失败。
- **中英双语。** 站点、指南、编辑器界面随处可切换。
- **两种入口。** 文件夹模式（同级图片 + 备份）或单个自包含 HTML（图片 base64 内联）。
- **本地优先。** 文件留在磁盘；服务端只在导出那几秒碰一下内容。

## 浏览器支持

| 浏览器 | 文件夹模式 | 单文件模式 |
| --- | --- | --- |
| Chrome / Edge / Brave / Arc / Opera | 支持 | 支持 |
| Safari / Firefox | 计划中（ZIP 兜底） | 计划中 |

## 隐私

**编辑期间，数据不离开本机。** 只有点导出时，内容在临时目录待几十秒就被删掉。不持久化，不拿去训练。

## 文档

- [docs/ROADMAP.md](docs/ROADMAP.md) — 后续规划
- [docs/GROWTH.md](docs/GROWTH.md) — 定位与渠道
- [docs/PRD.md](docs/PRD.md) · [docs/TRD.md](docs/TRD.md) — 产品与技术方案

## 参与贡献

给真正天天用这个工作流的人做的。欢迎 Issue 和 PR — 如果它能帮你省下答辩前那一个难受的晚上，就已经值了。

## License

[MIT](LICENSE)
