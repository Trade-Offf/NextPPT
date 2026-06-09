export type TemplateKind = 'deck' | 'doc';

export interface TemplateItem {
  id: string;
  kind: TemplateKind;
  tags: string[];
  prompt: string;
  sampleUrl?: string;
  credit?: { name: string; href: string };
}

const KAMI_CREDIT = { name: 'Kami · Tw93', href: 'https://kami.tw93.fun/index-zh.html' } as const;

export const TEMPLATES: TemplateItem[] = [
  {
    id: 'nextppt-kami',
    kind: 'deck',
    tags: ['Kami', 'NextPPT'],
    sampleUrl: '/kami-nextppt-deck.html',
    credit: KAMI_CREDIT,
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
字体栈（body / 标题统一）：--serif: "TsangerJinKai02", Charter, "Noto Serif SC", "Source Han Serif SC", "Songti SC", Georgia, serif
  · 中文衬线：TsangerJinKai02（仓耳今楷），@font-face 两档真实字重：
    W04(400): https://cdn.jsdelivr.net/gh/tw93/Kami@main/assets/fonts/TsangerJinKai02-W04.ttf
    W05(500): https://cdn.jsdelivr.net/gh/tw93/Kami@main/assets/fonts/TsangerJinKai02-W05.ttf
  · 英文衬线：Charter；body 加 font-synthesis: none；serif 正文 400、标题 500
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
  {
    id: 'resume',
    kind: 'doc',
    tags: ['Kami', 'resume', 'A4'],
    sampleUrl: '/kami-resume-musk.html',
    credit: KAMI_CREDIT,
    prompt: `用官方 Kami 设计系统帮我排一份中文个人简历，输出自包含 HTML。
内容与履历我会另行提供；以下只规定结构与视觉规范，不限定写什么。

────────────────────────────────────────
版式
────────────────────────────────────────
A4 竖版（@page { size:A4; margin:11mm 13mm; background:#f5f4ed }），严格 2 页。
屏幕预览：body { max-width:210mm; margin:0 auto }。
字体栈统一：--serif: "TsangerJinKai02", Charter, "Noto Serif SC", "Source Han Serif SC", "Songti SC", Georgia, serif
  · 中文衬线 TsangerJinKai02（仓耳今楷），@font-face W04(400) + W05(500) 真实字重（CDN: tw93/Kami@main/assets/fonts/）
  · 英文衬线 Charter；body 加 font-synthesis: none；serif 正文 400 / 标题 500；代码/数字用 mono
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
  {
    id: 'deck-classic',
    kind: 'deck',
    tags: ['Terminal', 'Dev', '16:9'],
    sampleUrl: '/dev-share-deck.html',
    prompt: `用「GitHub 暗色 / 终端 IDE」视觉风格帮我把内容排成一份演示稿（主题与内容我会另行提供）。
输出自包含 HTML，遵循 section.slide 协议（每页 <section class="slide">，固定 1280×720px），信息密度高、版面布满。
以下只规定视觉与排版规范，不限定你写什么内容。

────────────────────────────────────────
01 · Canvas 画布（暗色）
────────────────────────────────────────
页面底：#000（body）；幻灯片底 bg #0d1117
分层背景：bg-2 #161b22（卡片 / 引语 / 代码框）、bg-3 #1c222b（代码框头、节点）
描边线：line #30363d、line-soft #21262d
可选肌理：feTurbulence 噪点叠 mix-blend-mode: screen，opacity≈0.03，极弱
禁止：任何浅色 / 纸张底；禁止把语义色当背景大面积铺。

────────────────────────────────────────
02 · Accent 强调色 + 语义色
────────────────────────────────────────
唯一品牌强调：Terminal Orange #f78166（标题 .hl、kicker、左竖线、金句、当前态卡片边框）
强调色占比克制（≈10% 以内），靠它点睛而非铺面。
语义色仅用于「代码高亮 / 状态 / 痛点-方案」语义，不作装饰：
  green #3fb950（成功 / 解决方案 / 字符串）
  blue  #58a6ff（函数 / 链接 / 信息）
  yellow #d29922（数字字面量 / 警告）
  purple #bc8cff（关键字）
  red   #f85149（痛点 / 报错 / 危险）
禁止：再引入第三方装饰色；禁止彩色渐变铺底（仅金句条允许橙色微渐变）。

────────────────────────────────────────
03 · Neutrals 文本灰阶
────────────────────────────────────────
text #e6edf3（正文主色）· text-2 #c9d1d9（次要正文）
muted #8b949e（说明 / 标签）· muted-2 #6e7681（最弱 / 装饰）
正文用 text/text-2，元信息用 muted/muted-2，层级靠灰阶而非加粗。

────────────────────────────────────────
04 · Typography 字体层级
────────────────────────────────────────
Sans（标题 / 正文）：Inter / "PingFang SC" / -apple-system
Mono（代码 / 文件路径 / 标签 / 编号 / 终端行）：JetBrains Mono
技术性元数据一律 Mono，叙述性文字一律 Sans，二者不混用。

响应式字号（clamp，min/vw/max）：
  Hero   clamp(40px,6vw,96px)  weight 900  line-height 1.15  字距 -2~-4px
  H2     clamp(32px,3.5vw,56px) weight 800
  H3     clamp(28px,2.8vw,44px) weight 800
  H4     clamp(20px,2vw,24px)
  Body   clamp(13px,1.2vw,16px) weight 400  line-height 1.55
  BodyLg clamp(16px,1.5vw,22px)
  Mono   clamp(11px,1vw,15px)
  Caption clamp(10px,0.9vw,13px)
大标题用负字距收紧；强调改用 .hl 橙色或字号升档，而非滥用 bold。

────────────────────────────────────────
05 · Slide 骨架（每页三段）
────────────────────────────────────────
顶部 titlebar（仿 IDE 标签栏，高 32px）：
  左：三个交通灯圆点（red #f85149 / yellow #d29922 / green #3fb950）
  中：文件路径面包屑 <span class="dim">~/dir/</span>file.md（mono 11px）
  右：tb-right 元信息（如 "10 min · live demo" / "scene 1 / 3"）
中部 body（flex 纵向，padding clamp(32~56px)）：
  kicker（mono、橙色、::before 内容 "//"）→ page-title（H3，.hl 橙色高亮关键词）→ page-lead（muted，max-width≈820px）
底部 footer（mono caption）：左 区块标签 · 中 一句英文格言(.mid) · 右 页码 <span class="accent">NN</span> / 总页数

────────────────────────────────────────
06 · Components 原子组件
────────────────────────────────────────
Kicker：mono + letter-spacing 1px + 橙色，前缀 "//"
Quote block：bg-2 + 左 3px 橙色实线 + mono；强调词 <b> 橙色
Arch diagram：bg-2 卡，::before 角标 "// xxx.arch"；分层 arch-layer（label 右对齐 + nodes 横排），重点节点 .accent（橙边 + rgba 橙底 0.08）；层间 arch-flow 箭头 ▲；底部 dashed 分隔的 arch-caption（结论用 green <b>）
VS 两栏：grid 1fr auto 1fr，中间 vs-plus "&"（橙色）；右栏 .mine 加橙边 + 0 0 0 3px 橙色微光；列表 vs-list 用 "→" 前缀（.mine 前缀橙色）
Scene 卡（场景页）：grid 左叙述 + 右代码框
  左：scene-badge（No.0X 橙数字）→ scene-title（H3）→ scene-sub（green，含 → 箭头）→ PAIN 块（red 左边框 + rgba red 0.06 底）→ FIX 块（green 左边框 + rgba green 0.06 底）→ scene-metrics（2 格）
  右：scene-right 代码面板，头部 scene-right-head（mono，"● live/running" 状态点）+ 可滚动 body
Metric 数据卡：大数字橙色 weight 800（带 .u 单位小字）+ mono 小标签(l)
History 卡：3 张时代卡，当前态 .now 用橙边 + rgba 橙底
Golden 金句条：橙色微渐变带 + 上下橙色细线 + ::before 引号；.hl 橙色加重；底部 .tag（mono "// XXX"）
Method 收束：method-title 用 "&gt;" 箭头连接关键词（.hl 橙）；m-formula 公式块（mono，数值 .v 橙 / .g 绿 / .eq 灰）；m-bottom 三条 RULE 卡
终端点缀：$ 提示符行（user 蓝色）、闪烁 cursor（橙色方块 blink 动画）、ASCII 树 ├─└─

────────────────────────────────────────
07 · Code Syntax 代码高亮配色（仅代码框内）
────────────────────────────────────────
cm 注释 → muted #8b949e
kw 关键字 → purple #bc8cff
str 字符串 → green #3fb950
fn 函数/字段 → blue #58a6ff
num 数字 → yellow #d29922
hi 高亮/输出 → orange #f78166（weight 600）
代码用 mono、line-height 1.7、低调 4px 滚动条；超长内容内部滚动，不撑破 720px。

────────────────────────────────────────
08 · Shadow & Radii 阴影圆角
────────────────────────────────────────
卡片圆角 6px（代码块 / 节点 4px）；阴影克制：幻灯片本体 0 25px 70px rgba(0,0,0,0.6) 即可，组件用 1px 描边而非投影。
区块强调用「橙色边框 / 橙色微光（0 0 0 3px rgba(247,129,102,0.1)）」，不要硬投影。

────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
✗ 浅色 / 纸张底；✗ 语义色（红绿蓝黄紫）当装饰大面积铺底
✗ 橙色强调占比过高（沦为堆砌）；✗ 叙述正文用 mono、技术元数据用 sans（角色错配）
✗ 滥用 font-weight 700/800 当强调（应优先 .hl 橙 / 字号）
✗ 内容溢出 720px 不做内部滚动；✗ 引入第三方装饰色或彩色渐变铺底

────────────────────────────────────────
组织方式
────────────────────────────────────────
按内容自然组织页数与每页结构，不要凑页数或留半页空白。
每页都是 titlebar + body + footer 三段式，固定 1280×720，信息密度高、版面布满，遵循以上全部规范。`,
  },
];

export function findTemplate(id: string): TemplateItem | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
