/**
 * The copy-paste prompt that turns any chat AI (ChatGPT / Claude / Gemini /
 * Cursor …) into a generator of decks that HTML Deck Studio can open directly.
 *
 * The hard constraints below mirror the parser in `fs/adapter.ts`
 * (only `section.slide` is recognised, `<title>` becomes the deck title, head
 * `<style>` is injected into the preview) and the 1280x720 (16:9) canvas the
 * editor renders at. Keep them in sync if the parser changes.
 */
export const GENERATE_PROMPT = `你是一名资深演示设计师 + 前端工程师。请为主题「{{在这里填写你的主题}}」生成一份可直接用于演示的单文件 HTML 幻灯片。

【最重要的输出要求】
- 只输出一个完整的 .html 文件全文，从 <!doctype html> 开始到 </html> 结束。
- 不要任何解释、前言、结语，不要用 \`\`\` 代码围栏包裹。

【文档结构（必须严格遵守）】
1. 顶层为完整 HTML 文档：<!doctype html><html lang="zh-CN"><head> … </head><body> … </body></html>。
2. <head> 中必须包含：
   - <meta charset="UTF-8" />
   - <title>用一句话概括主题</title>（这会成为演示稿标题）
   - 一个 <style> 标签，所有样式都写在这里（不要外链 CSS 文件）。
3. 每一页幻灯片都是一个 <section class="slide"> … </section>，直接作为 <body> 的子元素依次排列。
   - class 必须正好包含 slide（解析器只识别 section.slide）。

【尺寸与样式（必须严格遵守）】
- 每个 .slide 尺寸严格为 16:9：width: 1280px; height: 720px; box-sizing: border-box; overflow: hidden; position: relative。
- 用 flex/grid 在这 1280×720 的固定画布内排版，内容不要溢出。
- 配色、字体、间距都在 head 的 <style> 里定义；可用 @import 引入 Google Fonts，或使用系统字体栈。
- 文本一律用语义标签承载：标题用 h1/h2/h3，正文用 p，要点用 ul>li，强调用 span/strong——这样用户进编辑器后可以直接点选改字。

【资源约束（必须严格遵守）】
- 禁止使用任何相对路径资源（如 ./img.png、assets/x.svg）——文件要能脱离文件夹独立打开。
- 需要图形时，只能用：内联 <svg>、data: URI（base64 内嵌图片），或可公网访问的绝对 CDN 链接（https://…）。

【内容要求】
- 产出 6–10 页，结构建议：封面 → 目录/概览 → 3–6 页核心内容（每页一个观点，配要点或图示）→ 结尾页（总结/行动号召）。
- 中文文案，专业、凝练、有信息量，避免空话。
- 视觉风格现代克制，统一配色与排版节奏，可适度使用渐变、卡片、图标增强层次。

请现在直接输出这份 .html 文件全文。`;

export interface ManualStep {
  title: string;
  desc: string;
}

export const MANUAL_STEPS: ManualStep[] = [
  {
    title: '复制提示词',
    desc: '点右上角「复制提示词」，把下方整段提示词复制走。',
  },
  {
    title: '填主题、丢给 AI',
    desc: '替换 {{在这里填写你的主题}} 后，发给 ChatGPT / Claude / Gemini / Cursor 等任意 AI。',
  },
  {
    title: '保存为 .html',
    desc: '把 AI 返回的完整代码保存为一个 .html 文件（例如 my-deck.html）。',
  },
  {
    title: '回来打开它',
    desc: '回到本页点「打开单个 HTML 文件」或把文件直接拖进来，即可开始点选编辑、一键导出。',
  },
];
