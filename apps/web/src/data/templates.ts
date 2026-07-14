type TemplateKind = 'deck' | 'doc';

export interface TemplateItem {
  id: string;
  kind: TemplateKind;
  tags: string[];
  prompt: string;
  sampleUrl?: string;
  credit?: { name: string; href: string };
  /** Hidden by default; only visible after the easter-egg unlock. */
  easterEgg?: boolean;
}

const KAMI_CREDIT = { name: 'Kami · Tw93', href: 'https://kami.tw93.fun/index-zh.html' } as const;
const FRONTEND_SLIDES_CREDIT = { name: 'zarazhangrui/frontend-slides', href: 'https://github.com/zarazhangrui/frontend-slides' } as const;
const PPT_MASTER_CREDIT = { name: 'hugohe3/ppt-master', href: 'https://github.com/hugohe3/ppt-master' } as const;

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
    easterEgg: true,
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
  {
    id: 'deck-report',
    kind: 'deck',
    tags: ['Business', 'PMO', '16:9'],
    sampleUrl: '/biz-report-deck.html',
    prompt: `用「浅色商务汇报」视觉风格帮我把内容排成一份面向管理层的多页汇报演示稿（主题与内容我会另行提供）。
输出自包含 HTML，遵循 section.slide 协议（每页 <section class="slide">，固定 1280×720px），信息密度高、版面布满，适合投屏与打印导出。
以下只规定视觉与排版规范，不限定你写什么内容。

────────────────────────────────────────
01 · Canvas 画布（暖浅色）
────────────────────────────────────────
幻灯片底：warm-paper #f6f5f0（同时设 @page { size:1280px 720px; margin:0 }，避免打印白边）
卡片 / 面板：纯白 #ffffff，次级面板 #fbfaf6
描边线：line #e4e2d8、line-soft #eceae1
每页顶部一条 6px 品牌色实线（.slide::after），作为统一视觉锚点
body（投屏外底）可用更深的 #cfccc0 衬托幻灯片浮起；禁止冷蓝灰 #f3f4f6 当背景

────────────────────────────────────────
02 · Accent 品牌色 + 语义色
────────────────────────────────────────
唯一品牌强调：Ink Navy #14457a（eyebrow、左竖线、页内关键词 .acc、品牌色顶边、品牌色卡片、SVG 主色块）
品牌色占比克制（≈10% 以内），靠它点睛而非铺面。
语义色仅用于「健康度 / 风险等级」语义，不作装饰：
  green #2e7d52（健康 / 已上线 / 绿灯）  tint #e6f1ea
  amber #a9781b（需跟进 / P1 / 黄灯）    tint #f5ecd8
  red   #bb3a2b（高风险 / P0 / 红灯）     tint #f6e6e2
禁止：再引入第四种装饰彩色；禁止彩色渐变铺底。

────────────────────────────────────────
03 · Neutrals 文本灰阶
────────────────────────────────────────
ink #16181d（标题 / 主数值）· ink2 #3c3f47（正文）
muted #6a6e77（说明 / 表头）· faint #9aa0a8（页码 / 轴线 / 装饰）
层级靠字号与灰阶拉开，而非滥用加粗。

────────────────────────────────────────
04 · Typography 字体层级（全篇单一无衬线）
────────────────────────────────────────
字体栈统一：--sans: "Inter", "Noto Sans SC", "PingFang SC", -apple-system, "Microsoft YaHei", sans-serif
（用 Google Fonts 引入 Inter + Noto Sans SC；CDN: https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+SC:wght@400;500;700;900&display=swap）
全篇只用这一套无衬线，标题正文不混排不同字族。数字加 font-variant-numeric: tabular-nums。

字号体系（投屏可读，刻意放大）：
  封面大标题  64px  weight 800  line-height 1.14
  页面标题    46px  weight 800  line-height 1.18  letter-spacing -.5px
  Lead 导语   22–24px weight 400 line-height 1.5（关键词用 <b> 700 + ink 或 .acc 品牌色）
  正文        19px  weight 400  line-height 1.6
  注释 cap    16.5px weight 400 line-height 1.55  color muted
  eyebrow     15px  weight 700  letter-spacing 3px  uppercase  品牌色
字重只用 400 / 700 / 800；强调改用字号升档 / .acc 品牌色 / 左侧 4px 竖线，不要合成 bold 当唯一强调手段。

────────────────────────────────────────
05 · Slide 骨架（每页统一）
────────────────────────────────────────
顶部 6px 品牌色条（::after）→ eyebrow（"NN · 章节名"，品牌色 uppercase）→ page-title（46px）→ lead（导语，一句话给判断）
中部 .grow（flex:1）：放主体（卡片网格 / 表格 / 图表 / 列表），居中或撑满
底部固定两角：左 .mark（英文区块标签，uppercase faint）· 右 .pgnum（NN / 总页数，tabular-nums faint）

────────────────────────────────────────
06 · Components 原子组件
────────────────────────────────────────
Eyebrow：品牌色 + letter-spacing 3px + uppercase，作章节定位
Section 标题 .sect / 金句 .quote：左侧 4px 品牌色竖线 + padding-left
Tag（四色胶囊）：圆点 + 文字，品牌/green/amber/red 四种，背景用对应实色 tint（禁止 rgba 透明叠色）
等级 pill .lv（P0/P1/P2）：实色填充白字，P0 红 / P1 琥珀 / P2 品牌蓝
Dash 列表：方块短点（11px 圆角小方块，品牌色）代替圆点，position:absolute left:0
Card 卡片：白底 + 1px 描边 + 12px 圆角；顶部 5px 语义色边（b-red / b-amber / b-green / b-brand）标注状态
健康度行 .hrow：项目名 + 状态 pill（圆点 + 红/黄/绿）+ 一句状态说明
Heat matrix 资源热力矩阵：成员 × 项目网格，实心格=核心承担（品牌色）、浅色描边格=参与支援、空格=不涉及
Table：表头 muted + 2px 底线，行用 1px soft 分隔，无竖线
Rule 分隔线：1px line 色水平线

────────────────────────────────────────
07 · Inline SVG Charts 内联图表（至少 5 处）
────────────────────────────────────────
SVG 内 font-family 与页面同步（var(--sans)），用 .s-lab(ink 700) / .s-sub(muted) / .s-axis(faint 600) 三档文字，text-anchor / dominant-baseline 精确对齐。
推荐 5 类（按内容选用，要求复杂、信息密集）：
  健康度环形图（Donut）：用 stroke-dasharray 分段，绿/黄/红比例，中心放总数
  风险分层金字塔（Pyramid / Funnel）：P0/P1/P2 三层递减矩形，各层用语义 tint 填充 + 语义色描边
  资源热力矩阵（Heat matrix）：成员 × 项目，实心/浅色/空格三态（也可用上面的 .mtx 组件实现）
  产能折线 / 面积图（Line + Area）：含饱和参考虚线、面积填充品牌 tint、关键点用红色高亮 + 文字标注
  主线接力流程图（Flow）：圆角节点 + 箭头 marker，当前态节点用品牌 tint 边框、风险态用红 tint 边框

SVG 配色规则：
  轴线 / 辅助线：line #e4e2d8 或 faint，参考线用 stroke-dasharray
  焦点 / 主色块：品牌 #14457a；语义状态用 green/amber/red
  文字：ink #16181d（数值）/ muted #6a6e77（说明）

────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
✗ 背景用冷蓝灰 #f3f4f6 或语义色大面积铺底
✗ Tag 用 rgba() 透明色叠色（应使用实色 tint）
✗ 混排多种字族（应全篇单一无衬线）
✗ 滥用 font-weight 当唯一强调（应优先字号 / .acc 品牌色 / 左竖线）
✗ 引入第四种装饰彩色或彩色渐变铺底
✗ 品牌色占比过高沦为堆砌；✗ 内容溢出 720px 不做收敛

────────────────────────────────────────
组织方式
────────────────────────────────────────
按内容自然组织页数（约 10–12 页）与每页结构，不要凑页数或留半页空白；图表类型按内容选用，至少 5 处内联 SVG。
每页都是 eyebrow + title + body + 角标 的统一骨架，固定 1280×720，信息密度高、版面布满，遵循以上全部规范。
适合的内容：项目管理分析、健康度评估、风险分层、资源瓶颈、历史趋势、行动计划、管理层摘要等向上汇报场景。`,
  },
  {
    id: 'sakura-chroma',
    kind: 'deck',
    tags: ['Sakura', 'Chroma', '16:9'],
    sampleUrl: '/template-sakura-chroma.html',
    credit: FRONTEND_SLIDES_CREDIT,
    prompt: `用 Sakura Chroma 设计语言帮我把内容排成一份演示稿（主题与内容我会另行提供，或见下文）。
输出自包含 HTML，遵循 section.slide 协议（每页 <section class="slide">，固定 1280×720px），信息密度高，每页布满内容。

────────────────────────────────────────
01 · Canvas 画布
────────────────────────────────────────
页面底色：奶油纸 #F1E6CB
墨色文字：棕墨 #3A2516
6 色彩虹强调（红粉橙绿蓝黄），仅在装饰缎带、印章、数据条上克制使用，占比不超过 8%

────────────────────────────────────────
02 · Typography 字体
────────────────────────────────────────
标题：Big Shoulders Display（粗壮无衬线，大写）
正文：Albert Sans
代码/数据：JetBrains Mono
日文/中文：Noto Sans JP / Noto Sans SC
字号梯度：hero 120px / h2 72px / h3 44px / body 18px / caption 13px

────────────────────────────────────────
03 · 视觉签名
────────────────────────────────────────
花瓣簇装饰（封面/封底）、对角彩虹缎带（章节过渡）、12 角星芒印章、半色调纸纹纹理（opacity 0.16）
数据页用 6 色条带 + 等宽数字；引用页用大引号 + 斜体衬线

────────────────────────────────────────
组织方式
────────────────────────────────────────
约 8 页：cover / manifesto / catalogue / stripe-data / quote / schedule / colophon，每页固定 1280×720，信息密度高、版面布满。`,
  },
  {
    id: 'cobalt-grid',
    kind: 'deck',
    tags: ['Cobalt', 'Grid', '16:9'],
    sampleUrl: '/template-cobalt-grid.html',
    credit: FRONTEND_SLIDES_CREDIT,
    prompt: `用 Cobalt Grid 设计语言帮我把内容排成一份演示稿（主题与内容我会另行提供，或见下文）。
输出自包含 HTML，遵循 section.slide 协议（每页 <section class="slide">，固定 1280×720px），信息密度高，每页布满内容。

────────────────────────────────────────
01 · Canvas 画布
────────────────────────────────────────
页面底色：象牙纸 #F0EBDE
主强调色：电光钴蓝 #1F2BE0（占比不超过 10%）
极淡蓝网格背景：rgba(31,43,224,0.10)，1px 细线，24px 间距
上下发丝线分隔每页

────────────────────────────────────────
02 · Typography 字体
────────────────────────────────────────
衬线（斜体）：Newsreader（用于引言、章节名）
无衬线：Hanken Grotesk（正文、UI）
等宽：DM Mono（数据、标签、页码）
字号梯度：hero 96px / h2 56px / h3 36px / body 16px / mono 13px

────────────────────────────────────────
03 · 视觉签名
────────────────────────────────────────
graph-paper 方格纸背景、像素阶梯 SVG 装饰、QR 块、钴蓝实心方块作为项目符号
数据页用 mono 数字 + 钴蓝条形图；引用页用 Newsreader 斜体大字号

────────────────────────────────────────
组织方式
────────────────────────────────────────
约 8 页：cover / manifesto / index / chapter / data / quote / table / colophon，每页固定 1280×720，信息密度高、版面布满。`,
  },
  {
    id: 'peoples-platform',
    kind: 'deck',
    tags: ['Block', 'Bold', '16:9'],
    sampleUrl: '/template-peoples-platform.html',
    credit: FRONTEND_SLIDES_CREDIT,
    prompt: `用 People's Platform (Block & Bold) 设计语言帮我把内容排成一份演示稿（主题与内容我会另行提供，或见下文）。
输出自包含 HTML，遵循 section.slide 协议（每页 <section class="slide">，固定 1280×720px），信息密度高，每页布满内容。

────────────────────────────────────────
01 · Canvas 画布
────────────────────────────────────────
页面底色：奶油纸 #F5EFE0
三色强调：蓝 #2C2CDC（主）/ 橙 #F2A03A / 红 #E83A2A，块状大面积使用
grain 噪点纹理叠层

────────────────────────────────────────
02 · Typography 字体
────────────────────────────────────────
超粗 slab：Alfa Slab One（巨型标题，带厚重 text-shadow 印章感）
窄体无衬线：Archivo Narrow（正文）
手写体：Caveat Brush（强调、批注）
等宽：DM Mono（数据、标签）
字号梯度：cover 160px / h2 90px / h3 48px / body 18px / mono 13px

────────────────────────────────────────
03 · 视觉签名
────────────────────────────────────────
色块大面积平涂、超粗 slab 标题 + 多层 text-shadow 立体印章感、grain 噪点、粗黑边框分隔
数据页用超大数字 + 色块；对比页用左右分屏色块对照

────────────────────────────────────────
组织方式
────────────────────────────────────────
约 10 页：cover / toc / manifesto / pillars / stat / platform / quote / timeline / compare / close，每页固定 1280×720，信息密度高、版面布满。`,
  },
  {
    id: 'long-table',
    kind: 'deck',
    tags: ['Long', 'Table', '16:9'],
    sampleUrl: '/template-long-table.html',
    credit: FRONTEND_SLIDES_CREDIT,
    prompt: `用 Long Table 设计语言帮我把内容排成一份演示稿（主题与内容我会另行提供，或见下文）。
输出自包含 HTML，遵循 section.slide 协议（每页 <section class="slide">，固定 1280×720px），信息密度高，每页布满内容。

────────────────────────────────────────
01 · Canvas 画布
────────────────────────────────────────
页面底色：暖奶油 #FAF1E2
唯一强调色：单一锈红 #B53D2A（占比不超过 8%，克制使用）
禁止引入第二种彩色

────────────────────────────────────────
02 · Typography 字体
────────────────────────────────────────
大写无衬线：Bricolage Grotesque（标题，全大写）
斜体衬线：Fraunces（引言、强调词，italic）
字号梯度：hero 110px / h2 64px / h3 40px / body 17px / caption 13px

────────────────────────────────────────
03 · 视觉签名
────────────────────────────────────────
描边胶囊按钮（border + 透明底）、圆形版次徽章、rect-tag 矩形标签、seats-pill 座位胶囊
清单/菜单页用表格化排版 + 锈红圆点项目符号；引用页用 Fraunces 斜体大字

────────────────────────────────────────
组织方式
────────────────────────────────────────
约 8 页：cover / manifesto / index / featured / menu / quote / schedule / closing，每页固定 1280×720，信息密度高、版面布满。`,
  },
  {
    id: 'brutalist-newspaper',
    kind: 'deck',
    tags: ['Brutalist', 'Newspaper', '16:9'],
    sampleUrl: '/template-brutalist-newspaper.html',
    credit: PPT_MASTER_CREDIT,
    prompt: `用「Brutalist 报章风」设计语言帮我把内容排成一份演示稿（主题与内容我会另行提供，或见下文）。
输出自包含 HTML，遵循 section.slide 协议（每页 <section class="slide">，固定 1280×720px），信息密度极高、版面布满，像一份折叠的报纸。
以下只规定视觉与排版规范，不限定你写什么内容。

────────────────────────────────────────
01 · Canvas 画布
────────────────────────────────────────
页面底色：newsprint #f4f1ea（米白报纸纸，同时设 @page { background: #f4f1ea }）
正文墨色：ink #1a1a1a（近黑油墨，不取纯黑）
次级墨色：ink-2 #3d3d3d / muted #6b6b6b / faint #9a9a9a
唯一强调色：spot-red #C8102E（仅用于关键数字、 kicker、印章、警示线，全篇占比不超过 3%）
禁止引入第二种彩色；禁止渐变铺底；禁止纯白 #ffffff 当背景

────────────────────────────────────────
02 · Halftone 半色调图
────────────────────────────────────────
所有图片用 halftone 黑白处理：filter: grayscale(1) contrast(1.15) brightness(0.95)
再叠一层 radial-gradient 模拟网点：background-image: radial-gradient(circle at 1px 1px, rgba(0,0,0,0.5) 1px, transparent 1.5px); background-size: 3px 3px; opacity: 0.5
图片四周用 1.5px 实线 ink 描边，不要圆角
禁止彩色照片；禁止 box-shadow 软投影

────────────────────────────────────────
03 · Typography 字体层级
────────────────────────────────────────
衬线（标题 / 正文）：'Libre Caslon Text', 'Times New Roman', Georgia, serif
无衬线（kicker / 标签 / caption）：'Inter', 'Helvetica Neue', sans-serif，weight 700-900
等宽（数据 / 页码 / 时间戳）：'JetBrains Mono', ui-monospace, monospace

字号梯度（刻意密集，像报纸）：
  Masthead   72-96px  serif weight 700  line-height 0.95  letter-spacing -0.02em
  H1         44-56px  serif weight 700  line-height 1.0
  H2         28-34px  serif weight 700  line-height 1.05
  H3         20-24px  serif weight 600  line-height 1.15
  Body Lead  16-18px  serif weight 400  line-height 1.45
  Body       13-14px  serif weight 400  line-height 1.5
  Caption    11-12px  sans weight 700   letter-spacing 0.08em  uppercase
  Micro      9-10px   mono weight 500   letter-spacing 0.1em
强调改用 .spot 红色或字号升档，不要合成 bold 当唯一手段

────────────────────────────────────────
04 · Layout 报章网格
────────────────────────────────────────
每页用 12 列网格（grid-template-columns: repeat(12, 1fr); gap: 16px）
满版排版，padding 只用 32-40px，不要大留白
栏目之间用 1px ink 实线分隔（border-right: 1px solid #1a1a1a）
跨栏标题用 grid-column: span 12；半栏图用 span 4-5
不规则破栏：cover 页 masthead 居中，正文页可以 5+4+3 不对称分栏
禁止居中卡片式布局；禁止大块留白

────────────────────────────────────────
05 · Slide 骨架
────────────────────────────────────────
顶部 masthead（高 56-72px）：
  左：报头名（serif 700 28-36px）+ 期号（mono 11px）
  中：分类标签（sans 700 12px uppercase，spot-red）
  右：日期 + 页码（mono 11px）
  下：1.5px ink 实线
中部 body（flex 纵向或 grid 12 列，padding 32-40px）：
  kicker（sans 700 11px uppercase，spot-red，前缀 "▍" 或 "//"）→ headline（serif H1）→ lead（serif lead）→ 多栏正文 + halftone 图
底部 footer（高 28px，1px ink 顶线）：
  左：栏目名 · 中：格言或注脚 · 右：页码 NN / TOTAL（mono）

────────────────────────────────────────
06 · Components 原子组件
────────────────────────────────────────
Kicker：sans 700 11px uppercase + spot-red + 前缀 "▍"
Drop cap：段首大写字母 serif 96px float:left + 3 行高 + spot-red
Pull quote：serif italic 32-40px + 上下 1px ink 线 + 左 3px spot-red 竖线
Stat block：mono 大数字 56-72px（spot-red）+ sans 小标签（uppercase 11px）
Data table：1px ink 实线边框，表头 sans 700 uppercase 11px 黑底白字，行高紧凑
Halftone figure：grayscale 图 + 网点叠层 + 1.5px ink 描边 + sans caption（11px uppercase）
Stamp：旋转 -8° 的矩形框 + sans 700 14px uppercase + spot-red 边框（"OFFICIAL" / "EXCLUSIVE" / "BREAKING"）
Byline：mono 10px "BY <NAME>" + sans 11px 出处
Rule line：1px ink 实线，或 1.5px 双线（border-top: 1.5px double #1a1a1a）
Column divider：1px ink 竖线分隔多栏

────────────────────────────────────────
07 · Inline SVG Charts 内联图表（至少 3 处）
────────────────────────────────────────
数据新闻风图表，黑白为主 + spot-red 点缀：
  柱状图：ink 实心柱 + spot-red 焦点柱 + 1px ink 轴线
  折线图：ink 实线 + spot-red 关键点 + dashed ink 参考线
  数据矩阵：单元格用 ink 实心 / 网格 / 空白三态，spot-red 高亮焦点格
  时间线：1px ink 主轴 + 实心圆点节点 + mono 日期标签
SVG 内 font-family 与页面同步；text-anchor / dominant-baseline 精确对齐
禁止彩色填充；禁止渐变；禁止阴影

────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
✗ 纯白背景或彩色照片；✗ 渐变铺底或软投影
✗ 引入第二种彩色（红以外）；✗ 居中卡片式留白布局
✗ 大块空白未填满；✗ 合成 bold 当唯一强调手段
✗ 圆角超过 4px；✗ 半透明 rgba 叠色（应实色）

────────────────────────────────────────
组织方式
────────────────────────────────────────
约 10 页：cover / headline / data / quote / feature / timeline / matrix / sidebar / closing / colophon，每页固定 1280×720，信息密度极高、版面像报纸一样布满，遵循以上全部规范。`,
  },
  {
    id: 'bloomberg-editorial',
    kind: 'deck',
    tags: ['Bloomberg', 'Data', '16:9'],
    sampleUrl: '/template-bloomberg-editorial.html',
    credit: PPT_MASTER_CREDIT,
    prompt: `用「Bloomberg / Economist 数据新闻编辑风」设计语言帮我把内容排成一份演示稿（主题与内容我会另行提供，或见下文）。
输出自包含 HTML，遵循 section.slide 协议（每页 <section class="slide">，固定 1280×720px），信息密度高、多列布局、微型图表丰富。
以下只规定视觉与排版规范，不限定你写什么内容。

────────────────────────────────────────
01 · Canvas 画布
────────────────────────────────────────
页面底色：paper #fafaf7（极浅米白，同时设 @page { background: #fafaf7 }）
正文墨色：ink #0a0a0a（近黑）
次级墨色：ink-2 #2a2a2a / muted #6b6b6b / faint #9a9a9a
品牌色：bloomberg-navy #1F3A5F（深海军蓝，标题、轴线、焦点数据）
辅助色：amber #d97706（警示 / 上升）、green #047857（向好 / 下降反向）
禁止纯白 #ffffff 当背景；禁止渐变铺底；禁止彩色照片

────────────────────────────────────────
02 · Typography 字体层级
────────────────────────────────────────
衬线（标题 / 引用）：'Source Serif Pro', 'Charter', Georgia, serif
无衬线（正文 / UI）：'Inter', 'Helvetica Neue', sans-serif
等宽（数据 / 表格 / 时间戳）：'JetBrains Mono', ui-monospace, monospace，font-variant-numeric: tabular-nums

字号梯度：
  Masthead   48-64px  serif weight 700  line-height 1.0  letter-spacing -0.02em
  H1         32-40px  serif weight 700  line-height 1.1
  H2         22-26px  serif weight 600  line-height 1.2
  H3         16-18px  sans weight 700   line-height 1.3  uppercase  letter-spacing 0.04em
  Body Lead  15-16px  serif weight 400  line-height 1.55
  Body       12-13px  sans weight 400   line-height 1.55
  Caption    10-11px  sans weight 600   letter-spacing 0.08em  uppercase
  Data       13-14px  mono weight 500   tabular-nums
  Micro      9-10px   mono weight 500   letter-spacing 0.1em
强调改用 navy 品牌色或字号升档，不要合成 bold 当唯一手段

────────────────────────────────────────
03 · Layout 多列编辑网格
────────────────────────────────────────
每页用 6-8 列网格（grid-template-columns: repeat(8, 1fr); gap: 20px）
padding 36-44px，栏间用 0.5px muted 竖线分隔
不对称分栏常见：主栏 5 列 + 侧栏 3 列，或 6+2
侧栏（sidebar）放：editor's note / 微型图表 / 相关数据 / 名词解释
禁止居中卡片式布局；禁止大块留白；每页都要有侧栏内容

────────────────────────────────────────
04 · Slide 骨架
────────────────────────────────────────
顶部 masthead（高 44-52px）：
  左：刊名（serif 700 24-28px）+ 期号（mono 11px）
  中：栏目标签（sans 700 11px uppercase，navy，下 2px navy 实线）
  右：日期 + 页码（mono 11px）
  下：0.5px ink 实线
中部 body（grid 8 列，padding 36-44px）：
  section-label（sans 700 11px uppercase，navy）→ headline（serif H1）→ deck（serif lead，一句话摘要）→ 多栏正文 + 微型图表 + 侧栏
底部 footer（高 24px，0.5px ink 顶线）：
  左：栏目 · 中：来源 / 注脚 · 右：页码 NN / TOTAL（mono）

────────────────────────────────────────
05 · Components 原子组件
────────────────────────────────────────
Section label：sans 700 11px uppercase + navy + 下 2px navy 实线
Deck（副标题）：serif italic 18-22px + muted + max-width 60ch
Pull quote：serif italic 28-36px + 左 3px navy 竖线 + 上下 0.5px ink 线
Stat card：mono 大数字 40-56px（navy 或 amber/green 语义色）+ sans 小标签 + 同比变化（▲ green / ▼ red）
Data table：表头 sans 700 uppercase 10px navy + 0.5px ink 下线，行用 0.5px muted 分隔，数字 mono tabular-nums 右对齐
Sidebar box：0.5px ink 边框 + padding 16px + sans 700 uppercase 10px 标题 + serif 13px 正文
Micro chart：60-120px 高的微型图表，0.5px ink 轴线 + navy 数据线
Editor's note：serif italic 12px + muted + 左 2px muted 线
Source line：mono 9px + faint + "SOURCE: ..."

────────────────────────────────────────
06 · Inline SVG Charts 内联图表（至少 5 处）
────────────────────────────────────────
数据新闻风微型图表，navy 主色 + amber/green 语义色：
  折线图：navy 实线 + amber 焦点 + dashed muted 参考线
  柱状图：navy 实心 + amber 焦点柱 + 0.5px ink 轴线
  环形图：navy 主段 + muted 次段 + 中心 mono 总数
  桑基图：navy 流线 + 0.5px ink 节点
  散点图：navy 圆点 + amber 焦点点 + 0.5px muted 象限线
  热力矩阵：单元格用 navy 实心 / 浅 navy / 空白三态
SVG 内 font-family 与页面同步；text-anchor / dominant-baseline 精确对齐
轴线 0.5px ink / muted；禁止渐变；禁止阴影

────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
✗ 纯白背景或彩色照片；✗ 渐变铺底或软投影
✗ 居中卡片式留白布局；✗ 大块空白未填满
✗ 合成 bold 当唯一强调；✗ 引入 navy/amber/green 以外的彩色
✗ 圆角超过 4px；✗ 表格用 rgba 透明色（应实色）

────────────────────────────────────────
组织方式
────────────────────────────────────────
约 12 页：cover / editor-note / contents / data-1 / data-2 / sidebar / compare / timeline / matrix / quote / risk / closing，每页固定 1280×720，多列布局、微型图表丰富、信息密度高、版面布满，遵循以上全部规范。`,
  },
  {
    id: 'swiss-grid',
    kind: 'deck',
    tags: ['Swiss', 'Grid', '16:9'],
    sampleUrl: '/template-swiss-grid.html',
    credit: PPT_MASTER_CREDIT,
    prompt: `用「瑞士国际主义平面设计风（Swiss Typographic Style）」设计语言帮我把内容排成一份演示稿（主题与内容我会另行提供，或见下文）。
输出自包含 HTML，遵循 section.slide 协议（每页 <section class="slide">，固定 1280×720px），严格网格、Helvetica、不对称平衡、红黑双色印刷感，致敬 Josef Müller-Brockmann。
以下只规定视觉与排版规范，不限定你写什么内容。

────────────────────────────────────────
01 · Canvas 画布
────────────────────────────────────────
页面底色：paper #f5f5f3（极浅暖灰白，同时设 @page { background: #f5f5f3 }）
正文墨色：ink #111111（近黑）
唯一强调色：swiss-red #C8102E（仅用于焦点元素：数字、几何块、强调词、网格指示线，全篇占比不超过 8%）
禁止引入第三种彩色；禁止渐变；禁止照片；禁止软投影

────────────────────────────────────────
02 · Typography 字体层级（全篇 Helvetica）
────────────────────────────────────────
字体栈统一：'Inter', 'Helvetica Neue', 'Helvetica', Arial, sans-serif
（用 Google Fonts 引入 Inter；CDN: https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&display=swap）
全篇只用这一套无衬线，标题正文不混排不同字族。
等宽（仅用于数据 / 编号）：'JetBrains Mono', ui-monospace, monospace

字号梯度（刻意大跨度，靠字号拉层级）：
  Display   96-128px  weight 900  line-height 0.9   letter-spacing -0.04em
  H1        64-80px   weight 700  line-height 0.95  letter-spacing -0.03em
  H2        40-48px   weight 600  line-height 1.0   letter-spacing -0.02em
  H3        24-28px   weight 500  line-height 1.15
  Body Lead 18-20px   weight 400  line-height 1.5
  Body      14-15px   weight 400  line-height 1.55
  Caption   11-12px   weight 500  line-height 1.4   letter-spacing 0.04em
  Label     9-10px    weight 700  line-height 1.3   letter-spacing 0.12em  uppercase
强调改用 swiss-red 或字号升档，不要合成 bold 当唯一手段

────────────────────────────────────────
03 · Layout 严格网格
────────────────────────────────────────
每页用 12 列网格（grid-template-columns: repeat(12, 1fr); gap: 24px; padding: 48-56px）
不对称平衡：标题占 7-9 列偏左 / 偏右，留 3-5 列负空间
负空间（negative space）是设计语言的一部分，不要填满
网格指示线（可选）：0.5px ink 虚线显示网格列，作为版式证据
禁止居中布局；禁止对称；禁止填满整个画布

────────────────────────────────────────
04 · Slide 骨架
────────────────────────────────────────
顶部（高 32-40px）：
  左：刊名 / 章节名（label 10px uppercase，swiss-red 或 ink）
  右：页码 NN / TOTAL（mono 11px）
  下：0.5px ink 实线
中部 body（grid 12 列，padding 48-56px）：
  label（uppercase 10px，swiss-red）→ display 标题（96-128px，偏左或偏右）→ body lead（18-20px，max-width 50ch）→ 几何块 / 图表 / 文字块按网格排列
底部（高 24px，0.5px ink 顶线）：
  左：栏目 · 中：格言 · 右：页码（mono）

────────────────────────────────────────
05 · Components 原子组件
────────────────────────────────────────
Label：sans 700 10px uppercase + letter-spacing 0.12em + swiss-red
Display number：sans 900 128px + swiss-red + line-height 0.9 + tabular-nums
Geometric block：纯色矩形 / 圆形 / 三角形，swiss-red 或 ink 实心，作为视觉锚点
Pull quote：sans 700 32-40px + 左 3px swiss-red 竖线 + max-width 40ch
Stat block：sans 900 64-80px 数字（swiss-red）+ sans 500 12px label（uppercase）
Rule line：0.5px ink 实线，或 2px swiss-red 实线（强调）
Grid guide：0.5px ink 虚线（stroke-dasharray: 2 4），显示 12 列网格
Bar / column chart：ink 或 swiss-red 实心矩形，无轴线
Section divider：2px swiss-red 水平线 + 上下大留白

────────────────────────────────────────
06 · Inline SVG 几何元素（至少 3 处）
────────────────────────────────────────
极简几何，红黑双色：
  柱状图：ink 或 swiss-red 实心矩形，无轴线，无网格
  圆形构图：swiss-red 实心圆 + ink 描边圆，作为视觉锚点
  线条图：2px ink 实线 + swiss-red 焦点段
  几何拼贴：矩形 + 圆形 + 三角形组合，按网格对齐
  网格图：12 列虚线网格 + 实心块标记焦点
SVG 内 font-family 与页面同步（Inter）
禁止渐变；禁止阴影；禁止彩色；禁止照片

────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
✗ 居中布局或对称构图；✗ 填满整个画布不留负空间
✗ 引入 swiss-red 以外的彩色；✗ 渐变 / 阴影 / 照片
✗ 混排多种字族（应全篇 Inter）；✗ 合成 bold 当唯一强调
✗ 圆角超过 2px；✗ 装饰性元素（应为功能几何）

────────────────────────────────────────
组织方式
────────────────────────────────────────
约 10 页：cover / quote / principle / grid / figure / type / layout / negative-space / output / colophon，每页固定 1280×720，严格 12 列网格、不对称平衡、红黑双色、大留白，遵循以上全部规范。`,
  },
];

export function findTemplate(id: string): TemplateItem | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
