/**
 * Curated templates marketplace data (skeleton).
 *
 * NextPPT does NOT generate — these entries are curated prompts/abilities the
 * user copies into their own AI tool. The generated HTML is then opened back in
 * NextPPT (PPT mode or Free-edit) to edit and export.
 *
 * `prompt` is intentionally left empty for now (placeholder cards). Fill in the
 * actual prompt text per entry later; the detail view shows a "to be added"
 * notice while it is empty. Titles/descriptions live in the `templates` i18n
 * namespace, keyed by `id` under `items.<id>`.
 */

export type TemplateKind = 'deck' | 'doc';

export interface TemplateItem {
  /** Stable id; also the i18n key under templates.items.<id> */
  id: string;
  /** Which editor mode the generated HTML is meant to be opened in. */
  kind: TemplateKind;
  /** Short labels shown on the card (not translated; keep generic/short). */
  tags: string[];
  /** Prompt body to copy. Empty = placeholder (shows a "to be added" notice). */
  prompt: string;
  /**
   * Optional public URL of a ready-made sample HTML. When set, the card shows a
   * live preview and the detail view offers "open in editor" + "download".
   */
  sampleUrl?: string;
}

export const TEMPLATES: TemplateItem[] = [
  {
    id: 'nextppt-kami',
    kind: 'deck',
    tags: ['Kami', 'NextPPT'],
    sampleUrl: '/kami-nextppt-deck.html',
    prompt: `用 Kami 设计系统帮我把内容排成一份演示稿（主题与内容我会另行提供，或见下文）。
输出自包含 HTML，遵循 section.slide 协议（每页 <section class="slide">，固定 1280×720px），信息密度高，每页布满内容。
以下只规定视觉与排版规范，不限定你写什么内容。

────────────────────────────────────────
01 · Canvas 画布
────────────────────────────────────────
页面底色：parchment #f5f4ed（同时设 @page { background: #f5f4ed }，避免打印白边）
卡片容器：ivory #faf9f5
交互面/按钮默认背景：warm-sand #e8e6dc
深色主题页：deep-dark #141413（保留橄榄底色，不取纯黑）
禁止：纯白 #ffffff 和冷蓝灰 #f3f4f6

────────────────────────────────────────
02 · Accent 强调色
────────────────────────────────────────
唯一强调色：Ink Blue #1B365D
深色底亮变体：#2D5A8A
全页面 Ink Blue 占比不超过 5%，超过即从克制变成堆砌
禁止引入第二种彩色（无红、绿、橙、紫）

────────────────────────────────────────
03 · Warm Neutrals 暖调中性灰
────────────────────────────────────────
Near Black  #141413
Dark Warm   #3D3D3A
Olive       #504E49
Stone       #6B6A64
Mute        #A8A59B
全部灰色必须有暖黄底色（R ≈ G > B），禁止冷蓝灰。

Tag Tint 实色对照表（Ink Blue 叠 parchment，禁止用 rgba()，WeasyPrint 双层矩形 bug）：
  极淡 0.08 → #EEF2F7
  标准 0.14 → #E4ECF5
  默认 0.18 → #E4ECF5
  加重 0.22 → #D0DCE9
  最强 0.30 → #D6E1EE

────────────────────────────────────────
04 · Typography 字体层级
────────────────────────────────────────
Serif（标题 / 引语 / 数字强调）：TsangerJinKai02（中文）/ Charter（英文）
Sans（正文）：Noto Sans SC / -apple-system / PingFang SC
Mono（代码 / 版本号 / hex）：JetBrains Mono

字号与行高（px 近似 pt × 1.33）：
  Display   36–48px  weight 500  line-height 1.10
  H1        18–22px  weight 500  line-height 1.20
  H2        14–16px  weight 500  line-height 1.25
  H3        12–13px  weight 500  line-height 1.30
  Body Lead    16px  weight 400  line-height 1.55
  Body       13–14px  weight 400  line-height 1.50
  Caption      12px  weight 400  line-height 1.45
  Label      10–11px  weight 600  line-height 1.35

禁止：font-weight ≥ 600 的合成 bold；需要强调改用字号升档或品牌色左侧 2px 竖线。

────────────────────────────────────────
05 · Spacing & Radii 间距与圆角
────────────────────────────────────────
基础单位 4px，密度越高 margin 越小：
  xs   2–3px   同行内元素
  sm   4–5px   tag padding、紧凑布局
  md   8–10px  组件内部
  lg  16–20px  组件之间、卡片 padding
  xl  24–32px  section 标题 margin
  2xl 40–60px  大 section 之间

圆角尺度：
  4px  极紧  |  6px  代码块  |  8px  默认卡片
  12px 容器  |  16px 特色卡  |  24px 大容器

────────────────────────────────────────
06 · Shadow 阴影
────────────────────────────────────────
Ring    → box-shadow: 0 0 0 1px rgba(20,20,19,0.10)   // 卡片、按钮默认态
Whisper → box-shadow: 0 4px 20px rgba(0,0,0,0.05)     // 特色卡浮起
明暗交替 → parchment ⇌ deep-dark，section 级对比（最强深度）
禁止：硬投影如 0 2px 8px rgba(0,0,0,0.3)，以及任何 drop-shadow filter

────────────────────────────────────────
07 · Components 原子组件
────────────────────────────────────────
Quote（引语）：border-left: 2px solid #1B365D；文字色 olive #504E49；font-family serif
Metric（数据卡）：serif 大数字颜色 #1B365D + sans 小标签，tabular-nums
Dash list（列表）：短横线 "—" 代替圆点 "•"，position:absolute left:0
Tag（三档）：
  极淡 background #EEF2F7，color #504E49
  标准 background #E4ECF5，color #1B365D
  加重 background #D0DCE9，color #1B365D，font-weight 500
Code block：background ivory #faf9f5；border: 0.5px solid #ddd9cc；border-radius 6px；font-family mono
Featured Card：box-shadow whisper + border-radius 16px
Section divider：水平线高度 1px，色 #ddd9cc（暖灰）
数字章节编号：font-family mono，color #1B365D，font-size 12px

────────────────────────────────────────
08 · Inline SVG Charts 内联图表（至少 5 处）
────────────────────────────────────────
从以下类型中选用，要求复杂、信息密集：
  架构图（Architecture）   流程图（Flowchart）   散点象限图（Quadrant）
  堆叠条形图（Stacked Bar） 环形图（Donut）       漏斗图（Funnel）
  甘特图（Gantt）          折线图（Line）        数据时间线

SVG 配色规则：
  轴线/辅助线：暖灰 #ddd9cc，stroke-dasharray 辅助
  焦点节点/主色块：#1B365D
  次色块渐变：#355D8A → #5E7DA3 → #90A8C4 → #C9D4E2
  文字：fill olive #504E49（说明）/ near-black #141413（数值）
  SVG 内 font-family 与页面同步，text-anchor/dominant-baseline 精确对齐

────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
✗ 背景用 #fff 纯白或 #f3f4f6 冷灰
✗ Tag 用 rgba() 透明色
✗ 标题 font-weight: 600 或 700 合成 bold
✗ box-shadow 硬投影（0.3 透明度以上）
✗ 引入红 / 绿 / 橙 / 紫等第二强调色
✗ Ink Blue 占面积超过 5%

────────────────────────────────────────
组织方式
────────────────────────────────────────
按内容自然组织页数与每页结构，不要凑页数或留半页空白；图表类型按内容选用。
每页都要信息密度高、版面布满，标题用 serif、正文用 sans，遵循以上全部规范。`,
  },
  { id: 'kami-doc', kind: 'doc', tags: ['Kami', 'doc'], prompt: '' },
  {
    id: 'resume',
    kind: 'doc',
    tags: ['Kami', 'resume', 'A4'],
    sampleUrl: '/kami-resume-musk.html',
    prompt: `用官方 Kami 设计系统帮我排一份中文个人简历，输出自包含 HTML。
内容与履历我会另行提供；以下只规定结构与视觉规范，不限定写什么。

────────────────────────────────────────
版式
────────────────────────────────────────
A4 竖版（@page { size:A4; margin:11mm 13mm; background:#f5f4ed }），严格 2 页。
屏幕预览：body { max-width:210mm; margin:0 auto }。
一页一种衬线：标题与正文同字体（TsangerJinKai02 → Noto Serif SC 回退），代码/数字单位可用 mono。
字重只用 400 / 500，不要合成 bold、不要斜体。

────────────────────────────────────────
配色（官方 Kami token）
────────────────────────────────────────
画布 parchment #f5f4ed，卡片 ivory #faf9f5，描边 #e8e6dc / #e5e3d8。
唯一强调色 Ink Blue #1B365D，占比 ≤5%；暖灰阶 #141413 / #3d3d3a / #504e49 / #6b6a64。
Tag 用实色（#EEF2F7 / #E4ECF5），禁止 rgba；禁止纯白与冷蓝灰；阴影只用 ring/whisper。

────────────────────────────────────────
结构（按需增删 section）
────────────────────────────────────────
1) 抬头：姓名（serif 26pt）+ 英文别名 + 岗位定位 + 联系方式，左侧 2.5pt 油墨蓝竖线
2) 4 个最强数字（metric：serif 大数 #1B365D + 小标签，tabular-nums）
3) 个人简介：≤80 字，1 处 .hl 高亮
4) 工作经历：三步时间线（讲判断力的演进，不是流水账）+ 3–5 个项目
   每个项目严格三段式 角色 / 动作 / 结果；结果只放可量化数据，每段 ≤1 处 .hl
5) 第 2 页：公司版图 / 判断与行动（3 张卡，每张一个判断+一个下游证据）/ 对外影响力 / 核心能力（5 行，每行 1 处强调）/ 教育背景（1 行）

每个 section 标题用油墨蓝左竖线；通篇克制留白、衬线撑层级。改完务必核对：严格 2 页、不溢出。`,
  },
  { id: 'longform', kind: 'doc', tags: ['report', 'long-form'], prompt: '' },
  { id: 'deck-classic', kind: 'deck', tags: ['deck', '16:9'], prompt: '' },
];

export function findTemplate(id: string): TemplateItem | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
