type TemplateKind = 'deck' | 'doc';

export interface TemplateItem {
  id: string;
  kind: TemplateKind;
  tags: string[];
  prompt: string;
  sampleUrl?: string;
  /**
   * Motion variant: when provided, the detail page shows a Static/Motion toggle.
   * - motionPrompt: prompt that extends `prompt` with a Motion & Interaction chapter
   * - motionSampleUrl: HTML sample with scroll-triggered reveal + signature animations
   * Existing static templates are untouched; only templates that opt in get the toggle.
   */
  motionPrompt?: string;
  motionSampleUrl?: string;
  credit?: { name: string; href: string };
  /** Hidden by default; only visible after the easter-egg unlock. */
  easterEgg?: boolean;
}

/** 模板选择指南 — 按场景推荐最合适的模板，避免场景错配。拼接到每个 motionPrompt 最前面，让 AI 先自检场景匹配。 */
const TEMPLATE_SELECTION_GUIDE = `
模板选择自检（开始生成前先确认场景与模板匹配）：
  · 品牌叙事 / 产品介绍 / 编辑刊物 / 个人作品集 → nextppt-kami（衬线 + 暖米黄 + Ink Blue）
  · 数据密集型商务汇报 / 项目简报 / 述职 / 项目管理分析 → deck-report（无衬线 + 状态色 + 表格密集）
  · 金融数据 / 市场分析 / 数据新闻 → bloomberg-editorial（数据新闻级编排）
  · 极简简历 / 个人介绍 → resume
  · 樱花彩虹 / 创意展示 → sakura-chroma
  · 钴蓝网格 / 技术架构 → cobalt-grid
  · 长表格 / 数据对照 → long-table
  · 人物平台 / 团队介绍 → peoples-platform
  · 报章砸落 / 强冲击封面 → brutalist-newspaper
  · Swiss Grid / 极简理性 → swiss-grid
  · 经典 Deck / 通用 → deck-classic

选错模板的典型表现（如果你判断内容属于"不适用场景"，在第一页顶部插入可见 banner 提醒用户切换模板）：
  · 用 Kami 做数据汇报 → 衬线+米黄底让数据可读性变差，显得"文艺范过重"
  · 用 deck-report 做品牌叙事 → 无衬线+状态色让品牌感丧失，显得"过于商务"
  · 用 brutalist-newspaper 做正式汇报 → 强冲击封面与严肃场景冲突

Banner 标准格式（必须可见，不要用 HTML 注释）：
  <div data-hds-warn style="position:absolute;top:0;left:0;right:0;background:#fef3c7;color:#92400e;padding:8px 76px;font-family:-apple-system,sans-serif;font-size:12px;letter-spacing:.02em;z-index:9999;border-bottom:1px solid #fde68a">⚠ 此内容更适合 {推荐模板} 模板，建议切换后重新生成</div>
  · data-hds-warn 属性会被编辑器运行时 cleanup() 自动剔除（与 data-hds-guide 同机制），保存/导出时不会污染最终 deck
  · 必须放在第一个 <section class="slide"> 内部最顶部
  · 用 sans-serif 字体（即使模板用衬线），保证可读性
`;

const KAMI_CREDIT = { name: 'Kami · Tw93', href: 'https://kami.tw93.fun/index-zh.html' } as const;
const FRONTEND_SLIDES_CREDIT = { name: 'zarazhangrui/frontend-slides', href: 'https://github.com/zarazhangrui/frontend-slides' } as const;
const PPT_MASTER_CREDIT = { name: 'hugohe3/ppt-master', href: 'https://github.com/hugohe3/ppt-master' } as const;

/** Motion chapter appended to the kami static prompt to form the motion prompt. */
const KAMI_MOTION_CHAPTER = `
────────────────────────────────────────
09 · Motion & Interaction 动效与交互（电影级编排）
────────────────────────────────────────
HTML 相比 PPT 的核心优势是"活的"——不是简单 fade-in，而是有节奏、有层次、有呼吸感的电影级动效。
以下规范确保每一页进入视口时都有"被导演过"的质感。

▎入场编排系统（Cinematic Reveal）
每个 .slide 进入视口时，子元素按"标题→副标题→正文→图表→数据卡"顺序依次入场，
每层之间错开 120ms，整体在 1.2s 内完成。默认隐藏态用 opacity:0 + 多种 transform 组合（不要只用 translateY）。

信息密度硬性要求：
  · 内容页至少 4 个独立信息块（卡片 / 图表 / 列表 / 引语）；封面 / 章节分隔 / quote 页除外（这些页面留白是设计语言的一部分）
  · SVG 图表 viewBox 高度利用率 ≥ 85%（禁止底部留白超过 15%）
  · 网格布局必须用 flex:1 或 grow class 撑满，禁止半页空白
  · 如果内容不足以填满 720px 高度，改用更紧凑的布局而非留白

位移幅度必须克制——超过 24px 会让 inline-block / SVG 文字触发换行或裁切：
  · class="reveal"         → opacity:0; transform:translateY(20px) （上浮，用于正文/卡片）
  · class="reveal reveal-scale"    → opacity:0; transform:scale(0.94) （缩放，用于图表/SVG 容器）
  · class="reveal reveal-blur"     → opacity:0; transform:translateY(16px); filter:blur(6px) （模糊聚焦，用于主标题；blur 不超过 6px）
  · class="reveal reveal-slide-l"  → opacity:0; transform:translateX(-24px) （左滑，用于左侧分栏内容）
  · class="reveal reveal-slide-r"  → opacity:0; transform:translateX(24px) （右滑，用于右侧分栏内容）
进入视口后：
  · .slide.is-visible .reveal → opacity:1; transform:none; filter:none;
    transition: opacity .7s cubic-bezier(0.16,1,0.3,1), transform .7s cubic-bezier(0.16,1,0.3,1), filter .7s ease
  · 延迟阶梯：reveal-d1(0s) / reveal-d2(.12s) / reveal-d3(.24s) / reveal-d4(.36s) / reveal-d5(.48s) / reveal-d6(.6s)
  · 触发：页尾 <script> 用 IntersectionObserver（threshold:0.18）给 .slide 加 .is-visible，一次性 unobserve

▎封面签名动效（Signature Animation — 必须有视觉冲击）
封面是第一印象，动效要比内页重 3 倍：
  · 匠心之轮外圈刻度环：@keyframes spin 40s linear infinite（比内页快，吸引视线）
  · 内圈反向旋转：@keyframes spin-reverse 60s linear infinite reverse（双环反向，制造齿轮感）
  · 中心三层光晕：分别 3s/4s/5s 脉冲，scale(1→1.2) + opacity(0.3→0.7)，错相位
  · 4 条径向线：stroke-dashoffset 全长→0，1.5s，每条延迟 .15s，绘制完成后保持
  · 封面标题：reveal-blur 整体入场（opacity:0 + translateY(16px) + blur(6px) → opacity:1 + none），
    不要用 JS 拆字逐字入场——inline-block span 会破坏 letter-spacing 一致性导致多行标题左对齐错位
  · 封面副标题：在标题完成后 0.3s 开始，reveal-blur 入场
  · 底部指标数字：count-up 动画（见下文）

▎数字滚动动画（Count-Up — 用于所有 Metric / 数据卡）
  · 带数据-num 属性的元素，进入视口时从 0 滚动到目标值，1.8s ease-out
  · JS：requestAnimationFrame 插值，支持整数和小数（1 位小数）
  · 千分位用逗号格式化
  · 示例：<span class="metric-num" data-num="1280000">0</span>

▎SVG 图表高级绘制（不只是 stroke-draw）
  · 折线图/曲线：stroke-dashoffset 全长→0，2s cubic-bezier(0.16,1,0.3,1)，绘制后保持
  · 柱状图：每根柱子 transform:scaleY(0)→scaleY(1)，transform-origin:bottom，0.8s，依次延迟 .1s
  · 环形图/饼图：stroke-dashoffset 从周长→目标值，1.5s ease-out（不是全画完，画到比例停止）
    环形图计算公式：
      周长 C = 2 × π × r
      stroke-dasharray = C（完整周长）
      stroke-dashoffset 起始 = C（完全隐藏）
      stroke-dashoffset 目标 = C × (1 - 比例)
      例：r=70, 测试占比 32.6%
        C = 2 × 3.1416 × 70 = 439.8
        dasharray = 439.8
        target = 439.8 × (1 - 0.326) = 296.5
  · 填充区域（area chart）：clip-path 从 width:0→width:100%，1.5s 延迟 .3s（在线条绘制后填充）
  · 数据点圆点：在线条绘制完成后依次弹出，scale(0→1) + opacity(0→1)，0.4s，stagger .08s
  · 所有 SVG 动画在 slide 可见时由 JS 添加 .is-animated class 触发

SVG 坐标与 dasharray 校验（必须执行）：
  · 折线图 line-anim 的 stroke-dasharray 必须等于实际路径长度（用 viewBox 单位计算）
    例：x1=40 x2=520，线长 = 480，dasharray 必须 = 480（不是固定 400）
  · 所有 <text> 必须按 text-anchor 估算宽度后留 ≥4px 安全余量
  · 所有 <rect>/<circle>/<polygon> 坐标 + 尺寸必须落在 viewBox 范围内
  · <g transform="translate(x,y)"> 内的子元素坐标要叠加 translate 值核算

▎视差效果（Parallax — 滚动时元素以不同速度移动）
  · 背景装饰元素（大号数字、几何图形、水印）：translateY 按滚动比例的 0.3 倍移动
  · 前景内容：正常滚动
  · JS：scroll 事件 + rAF，计算 slide 在视口中的偏移比例，设置 CSS 变量 --parallax
  · CSS：.parallax-bg { transform: translateY(var(--parallax, 0px)) }
  · 每页最多 1 个视差元素，避免性能问题

▎页面转场（Slide Transition）
  · .slide 之间用 24px gap + 背景色渐变过渡，不要硬切
  · 上一页离开视口时：opacity 渐变到 0.6（不完全消失，保持上下文感）
  · 当前页进入时：opacity 0.4→1，0.5s

▎光标跟随效果（Cursor Spotlight — 仅封面）
  · 封面背景有一个 radial-gradient 跟随鼠标位置的光斑
  · JS：mousemove 更新 CSS 变量 --cursor-x / --cursor-y
  · CSS：background-image: radial-gradient(300px circle at var(--cursor-x,50%) var(--cursor-y,50%), rgba(27,54,93,0.06), transparent 70%)
  · 必须用 transparent 70% 终止（不能只写 transparent），否则渐变会延伸到角落，整个封面被淡色雾覆盖，parchment 底色被遮住
  · 必须用 background-image 属性（不能是 background shorthand），否则会覆盖 .slide 的 background-color，导致封面失去容器底色、透出 body 灰底
  · 离开封面区域时光斑淡出

▎悬停微交互（Hover Micro-Interaction）
  · Featured Card：hover translateY(-6px) + shadow 加深 + border-color 变 brand 色，0.25s
  · Metric 卡：hover scale(1.03) + 数字轻微弹跳，0.2s
  · 可点击元素：hover cursor:pointer + 背景色过渡
  · SVG 图表元素：hover 时 stroke-width 加粗 + 颜色变 brand 色

▎呼吸感（Ambient Breathing — 持续动效让页面不"死"）
  · 关键图标/装饰元素：@keyframes breathe scale(1→1.05→1) 4s ease-in-out infinite
  · 品牌色强调点：@keyframes glow opacity(0.6→1→0.6) 3s ease-in-out infinite
  · 每页最多 2 个呼吸元素，避免视觉嘈杂

约束：
  · 不引入外部 JS 库（GSAP/Motion 等），只用原生 CSS @keyframes + IntersectionObserver + requestAnimationFrame
  · 全部动效在 <style> 和 <script> 内，不外链
  · 脚本总量不超过 120 行 vanilla JS（count-up + IntersectionObserver + parallax + cursor spotlight）
  · @media (prefers-reduced-motion: reduce) 关闭所有动画，.reveal 直接 opacity:1 transform:none filter:none
  · 性能：只用 transform / opacity / filter / clip-path 做动画，不触发 layout
  · 每页入场总时长不超过 1.5s，避免用户等待
  · 层叠上下文：每个 .slide 必须 isolation:isolate，防止 filter:blur() / transform 溢出影响相邻 slide
  · 文字不换行：多行标题不要用 JS 拆字逐字入场（inline-block span 会破坏 letter-spacing 一致性导致左对齐错位），改用 reveal-blur 整体入场
  · SVG 边界安全：所有 SVG 内部元素（含 <g transform="translate(x,y)"> 内的子元素）坐标 + 尺寸必须落在 viewBox 范围内；
    text 元素需按 text-anchor 估算文字宽度后留 ≥4px 安全余量；SVG width 属性用 "100%" 而非固定像素，避免超出 slide 内容区
  · 页面转场透明度：.slide:not(.is-visible) 的 opacity 不低于 0.6（低于 0.6 会让 parchment 透出 body 灰底，显得脏）
  · body 背景色用暖灰（#d8d3c4 系），不要用偏冷的 #c9c5b8，否则半透明 slide 露出的间隔色会发灰
  · SVG marker 引用：使用 marker-end="url(#id)" 前，必须在 SVG 内 <defs> 中定义 <marker>，否则箭头不显示。标准 marker 定义：
    <defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M1 1 L7 4 L1 7 Z" fill="#ddd9cc"/></marker></defs>
  · bar-anim 一致性：同一图表内所有柱子必须统一使用 bar-anim class + bar-dN 延迟，禁止部分柱子有动画部分没有（会导致视觉跳变）
`;

const KAMI_MOTION_ANTI_PATTERNS = `✗ 用 Kami 做数据密集型汇报（请切换到 deck-report 或 bloomberg-editorial）
✗ 引入 GSAP / Motion / 外部动画库
✗ 动效无 prefers-reduced-motion 降级
✗ 用 JS 拆字逐字入场（inline-block span 破坏 letter-spacing 一致性，多行标题左对齐错位）
✗ .slide padding 缩水（必须 54px 76px 56px，缩水会导致内容贴边）
✗ 缺失 editorial chrome（.eyebrow / .pgnum / .mark 必备，数据页额外 .src）
✗ .slide:not(.is-visible) opacity 低于 0.6（parchment 透出 body 灰底，画面发脏）
✗ body 背景用偏冷灰 #c9c5b8（半透明时间隔色发灰，不配 Kami 暖调）`;

/** Static Kami prompt — chapters 01–08 + anti-patterns + organization. */
const KAMI_STATIC_PROMPT = `用 Kami 设计系统帮我把内容排成一份演示稿（主题与内容我会另行提供，或见下文）。
适用场景：品牌叙事 / 产品介绍 / 编辑刊物 / 个人作品集 / 文化内容。
不适用场景：数据密集型商务汇报 / 项目简报 / 述职 / 财务报告（请改用 deck-report 或 bloomberg-editorial）。
如果你判断内容属于"不适用场景"，请在第一页顶部插入可见 banner（见上方模板选择指南的 Banner 标准格式）提醒用户切换模板。
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
.slide padding 强制值：54px 76px 56px（上 / 左右 / 下），不可缩水。缩水会导致内容贴边，丧失 Kami 的"留白呼吸感"。

────────────────────────────────────────
02 · Accent 强调色
────────────────────────────────────────
唯一强调色：Ink Blue #1B365D
深色底亮变体：#2D5A8A
Ink Blue 用量见 08 · SVG 配色规则的可执行校验（不要凭面积估算）
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

Editorial Chrome（必备，缺失即丧失 Kami 质感）：
  .eyebrow  顶部 mono 小标，letter-spacing 2.4px，uppercase，作为章节标识
  .pgnum    右下角页码，mono，tabular-nums，格式 "01 / 09"
  .mark     左下角品牌标识，mono，uppercase，如 "NEXTPPT · KAMI"
  .src      左下角数据来源（仅数据页），mono 9.5px，opacity 0.85
  每页必须有 .eyebrow + .pgnum + .mark；数据页额外加 .src。

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

  Ink Blue 占比校验（用可执行规则代替面积估算）：
    · 单个 SVG 内 #1B365D fill 最多用于 2 个元素：1 个焦点节点 + 1 个最大数据段（或关键路径）
    · 其余数据段一律用次色块：#355D8A → #5E7DA3 → #90A8C4 → #C9D4E2（按数值降序分配）
    · 堆叠条形图：仅最大的 1 个 segment 用 #1B365D，其余按数值降序用 #355D8A / #5E7DA3 / #90A8C4
    · 甘特图：仅关键路径用 #1B365D，其余任务用 #5E7DA3 / #90A8C4
    · 整页层面：#1B365D 只出现在"标题强调字 + 1 个 SVG 焦点 + 1 个数据卡数字"三处，不要铺满

────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
✗ 背景用 #fff 纯白或 #f3f4f6 冷灰
✗ Tag 用 rgba() 透明色
✗ 标题 font-weight: 600 或 700 合成 bold
✗ box-shadow 硬投影（0.3 透明度以上）
✗ 引入红 / 绿 / 橙 / 紫等第二强调色

────────────────────────────────────────
组织方式
────────────────────────────────────────
按内容自然组织页数与每页结构，不要凑页数或留半页空白；图表类型按内容选用。
每页都要信息密度高、版面布满，标题用 serif、正文用 sans，遵循以上全部规范。`;

/** Motion Kami prompt = static prompt + Motion chapter + motion anti-patterns. */
const KAMI_MOTION_PROMPT = `${TEMPLATE_SELECTION_GUIDE}
${KAMI_STATIC_PROMPT}
${KAMI_MOTION_CHAPTER}
────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
✗ 背景用 #fff 纯白或 #f3f4f6 冷灰
✗ Tag 用 rgba() 透明色
✗ 标题 font-weight: 600 或 700 合成 bold
✗ box-shadow 硬投影（0.3 透明度以上）
✗ 引入红 / 绿 / 橙 / 紫等第二强调色
${KAMI_MOTION_ANTI_PATTERNS}
────────────────────────────────────────
组织方式
────────────────────────────────────────
按内容自然组织页数与每页结构，不要凑页数或留半页空白；图表类型按内容选用。
每页都要信息密度高、版面布满，标题用 serif、正文用 sans，遵循以上全部规范。`;

/* ============================================================
 * deck-report — 浅色商务汇报（Ink Navy #14457a）
 * ============================================================ */

/** Static deck-report prompt — chapters 01–07 + anti-patterns + organization. */
const DECK_REPORT_PROMPT = `用「浅色商务汇报」视觉风格帮我把内容排成一份面向管理层的多页汇报演示稿（主题与内容我会另行提供）。
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
适合的内容：项目管理分析、健康度评估、风险分层、资源瓶颈、历史趋势、行动计划、管理层摘要等向上汇报场景。`;

/** Motion chapter appended to the deck-report static prompt. */
const DECK_REPORT_MOTION_CHAPTER = `
────────────────────────────────────────
09 · Motion & Interaction 动效与交互（稳重汇报级编排）
────────────────────────────────────────
面向 PMO 与管理层的汇报场景，动效的核心是"稳"——不炫技、不分散注意力，
让数据和判断在进入视口时被"庄重地呈现"，节奏接近 Keynote 翻页而非网页 scroll。
以下规范确保每一页进入视口时都有"被郑重交付"的质感。

▎入场编排系统（Cinematic Reveal）
每个 .slide 进入视口时，子元素按"eyebrow→标题→导语→图表→数据卡"顺序依次入场，
每层之间错开 100ms（比标准 120ms 更紧凑，符合汇报节奏），整体在 1.2s 内完成。
位移幅度克制，避免触发换行：
  · class="reveal"          → opacity:0; transform:translateY(20px) （上浮，用于正文/卡片）
  · class="reveal reveal-scale"   → opacity:0; transform:scale(0.95) （缩放，用于图表/SVG 容器）
  · class="reveal reveal-slide-l" → opacity:0; transform:translateX(-24px) （左滑，用于左侧栏数据卡）
  · class="reveal reveal-slide-r" → opacity:0; transform:translateX(24px) （右滑，用于右侧栏指标）
  · class="reveal reveal-fade"    → opacity:0 （纯淡入，用于表格行/热力格，避免位移干扰阅读）
进入视口后：
  · .slide.is-visible .reveal → opacity:1; transform:none;
    transition: opacity .6s cubic-bezier(0.16,1,0.3,1), transform .6s cubic-bezier(0.16,1,0.3,1)
  · 延迟阶梯：reveal-d1(0s) / reveal-d2(.1s) / reveal-d3(.2s) / reveal-d4(.3s) / reveal-d5(.4s) / reveal-d6(.5s)
  · 触发：页尾 <script> 用 IntersectionObserver（threshold:0.2）给 .slide 加 .is-visible，一次性 unobserve

▎封面签名动效（Signature Animation — 顶边品牌色生长 + 健康度首屏）
封面是第一印象，动效以"品牌色顶边生长"开场，再用环形健康度图收尾：
  · 顶部 6px 品牌色条：clip-path 从 width:0→width:100%，0.8s cubic-bezier(0.16,1,0.3,1)，开场第一帧
  · 封面标题：reveal-slide-l 整体入场（opacity:0 + translateX(-24px) → opacity:1 + none），0.7s
    不要用 JS 拆字逐字入场——会破坏 Inter letter-spacing 一致性
  · 封面副标题：标题完成后 0.2s，reveal-fade 入场
  · 封面右下角总览环形图（健康度）：stroke-dashoffset 周长→目标比例，1.5s ease-out，最后弹出中心总数
  · 底部页码与角标：最后 0.3s reveal-fade
  · 全篇禁止使用旋转、模糊、彩色脉冲等"炫技"动效——管理层汇报要稳

▎数字滚动动画（Count-Up — 用于所有 Metric / 数据卡 / KPI）
  · 带 data-num 属性的元素，进入视口时从 0 滚动到目标值，1.5s ease-out（比标准略慢，庄重感）
  · JS：requestAnimationFrame 插值，支持整数和小数（1 位小数）
  · 千分位用逗号格式化，百分比带 % 后缀
  · 示例：<span class="metric-num" data-num="1280000">0</span>

▎SVG 图表高级绘制（商务汇报三大图表定制）
  · 健康度环形图（Donut）：stroke-dashoffset 从周长→目标比例值停止（不是全画完），1.5s ease-out；
    分段用不同语义色（green/amber/red），中心 mono 数字 count-up
  · 风险分层金字塔（Pyramid）：clip-path 从 height:0→height:100%（自下而上揭示），1.2s；
    P0/P1/P2 三层依次显现，每层延迟 0.3s，揭示后边框定格
  · 产能折线 / 面积图（Line + Area）：stroke-dashoffset 全长→0，2s cubic-bezier(0.16,1,0.3,1)；
    面积填充延迟 0.4s clip-path width:0→100%；关键点用红色高亮 + 文字标注最后弹出
  · 资源热力矩阵：单元格逐个 reveal-fade，按行 stagger 0.04s，避免一次性铺满
  · 主线接力流程图：节点按顺序 scale(0.8→1) + opacity(0→1)，0.4s，stagger 0.15s，箭头随后绘制
  · 所有 SVG 动画在 slide 可见时由 JS 添加 .is-animated class 触发

▎视差效果（Parallax — 滚动时元素以不同速度移动）
  · 背景装饰元素（大号水印数字、几何块）：translateY 按滚动比例的 0.2 倍移动（比标准 0.3 更克制）
  · 前景内容：正常滚动
  · JS：scroll 事件 + rAF，计算 slide 在视口中的偏移比例，设置 CSS 变量 --parallax
  · CSS：.parallax-bg { transform: translateY(var(--parallax, 0px)) }
  · 每页最多 1 个视差元素

▎页面转场（Slide Transition）
  · .slide 之间用 24px gap + 背景色过渡，不要硬切
  · 上一页离开视口时：opacity 渐变到 0.7（保持上下文感，不完全消失）
  · 当前页进入时：opacity 0.5→1，0.4s

▎光标跟随效果（Cursor Spotlight — 仅封面）
  · 封面背景有一个 radial-gradient 跟随鼠标位置的光斑
  · JS：mousemove 更新 CSS 变量 --cursor-x / --cursor-y
  · CSS：background-image: radial-gradient(320px circle at var(--cursor-x,50%) var(--cursor-y,50%), rgba(20,69,122,0.05), transparent 70%)
  · 必须用 transparent 70% 终止（不能只写 transparent），否则渐变会延伸到角落，整个封面被淡色雾覆盖，parchment 底色被遮住
  · 必须用 background-image 属性（不能是 background shorthand），否则会覆盖 .slide 的 background-color，导致封面失去容器底色、透出 body 灰底
  · 离开封面区域时光斑淡出

▎悬停微交互（Hover Micro-Interaction）
  · Card 卡片：hover translateY(-4px) + box-shadow 加深 + 顶部语义色边加粗，0.25s
  · 健康度行 .hrow：hover 背景 #fbfaf6 + 左侧品牌色竖线显现，0.2s
  · 数据表格行：hover 背景 #fbfaf6 高亮
  · SVG 图表元素：hover 时 stroke-width 加粗 + 颜色变 Ink Navy

▎呼吸感（Ambient Breathing — 持续动效让页面不"死"）
  · 关键 KPI 数字旁的状态圆点：@keyframes pulse opacity(0.6→1→0.6) 2.5s ease-in-out infinite
  · 品牌色顶边条：@keyframes subtle-glow box-shadow 微微呼吸，4s ease-in-out infinite
  · 每页最多 2 个呼吸元素，避免视觉嘈杂；管理层汇报要克制

约束：
  · 不引入外部 JS 库（GSAP/Motion 等），只用原生 CSS @keyframes + IntersectionObserver + requestAnimationFrame
  · 全部动效在 <style> 和 <script> 内，不外链
  · 脚本总量不超过 120 行 vanilla JS（count-up + IntersectionObserver + parallax + cursor spotlight）
  · @media (prefers-reduced-motion: reduce) 关闭所有动画，.reveal 直接 opacity:1 transform:none
  · 性能：只用 transform / opacity / filter / clip-path 做动画，不触发 layout
  · 每页入场总时长不超过 1.5s，避免管理层等待
  · 层叠上下文：每个 .slide 必须 isolation:isolate，防止 transform 溢出影响相邻 slide
  · 文字不换行：多行标题不要用 JS 拆字逐字入场，改用 reveal-slide-l 整体入场
  · SVG 边界安全：所有 SVG 内部元素坐标 + 尺寸必须落在 viewBox 范围内；text 元素需按 text-anchor 估算文字宽度后留 ≥4px 安全余量；SVG width 属性用 "100%"
  · 汇报场景特有：禁止旋转、模糊、彩色脉冲等炫技动效；入场缓动统一用 cubic-bezier(0.16,1,0.3,1)，不要弹性回弹
  · 语义色不参与动画：green/amber/red 仅用于状态标记，不作为动效主色（环形图分段除外）
  · SVG marker 引用：使用 marker-end="url(#id)" 前，必须在 SVG 内 <defs> 中定义 <marker>，否则箭头不显示。标准 marker 定义：
    <defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M1 1 L7 4 L1 7 Z" fill="#999"/></marker></defs>
    fill 颜色按本模板的轴线/辅助线色设置（Kami 用 #ddd9cc，deck-report 用 #e5e7eb，cobalt-grid 用 #1F2BE0，bloomberg 用 #1F3A5F 等）
  · bar-anim 一致性：同一图表内所有柱子必须统一使用 bar-anim class + bar-dN 延迟，禁止部分柱子有动画部分没有
  · 环形图 stroke-dasharray 必须 = 2πr（周长公式），stroke-dashoffset 目标 = C × (1 - 比例)
  · 折线图 line-anim 的 stroke-dasharray 必须等于实际路径长度（不是固定数值）`;

const DECK_REPORT_MOTION_ANTI_PATTERNS = `✗ 引入 GSAP / Motion / 外部动画库
✗ 动效无 prefers-reduced-motion 降级
✗ 用旋转、模糊、弹性回弹等炫技动效（管理层汇报要稳）
✗ 语义色 green/amber/red 当作动效主色铺底闪烁
✗ 缓动用弹性曲线（应统一用 cubic-bezier(0.16,1,0.3,1) 庄重缓动）
`;

/** Motion deck-report prompt = static prompt + Motion chapter + motion anti-patterns. */
const DECK_REPORT_MOTION_PROMPT = `${TEMPLATE_SELECTION_GUIDE}
${DECK_REPORT_PROMPT}
${DECK_REPORT_MOTION_CHAPTER}
────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
✗ 背景用冷蓝灰 #f3f4f6 或语义色大面积铺底
✗ Tag 用 rgba() 透明色叠色（应使用实色 tint）
✗ 混排多种字族（应全篇单一无衬线）
✗ 滥用 font-weight 当唯一强调（应优先字号 / .acc 品牌色 / 左竖线）
✗ 引入第四种装饰彩色或彩色渐变铺底
✗ 品牌色占比过高沦为堆砌；✗ 内容溢出 720px 不做收敛
${DECK_REPORT_MOTION_ANTI_PATTERNS}
────────────────────────────────────────
组织方式
────────────────────────────────────────
按内容自然组织页数（约 10–12 页）与每页结构，不要凑页数或留半页空白；图表类型按内容选用，至少 5 处内联 SVG。
每页都是 eyebrow + title + body + 角标 的统一骨架，固定 1280×720，信息密度高、版面布满，遵循以上全部规范。
适合的内容：项目管理分析、健康度评估、风险分层、资源瓶颈、历史趋势、行动计划、管理层摘要等向上汇报场景。`;

/* ============================================================
 * sakura-chroma — 樱花彩虹（棕墨 #3A2516 + 6 色彩虹）
 * ============================================================ */

/** Static sakura-chroma prompt. */
const SAKURA_CHROMA_PROMPT = `用 Sakura Chroma 设计语言帮我把内容排成一份演示稿（主题与内容我会另行提供，或见下文）。
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
约 8 页：cover / manifesto / catalogue / stripe-data / quote / schedule / colophon，每页固定 1280×720，信息密度高、版面布满。`;

/** Motion chapter appended to the sakura-chroma static prompt. */
const SAKURA_CHROMA_MOTION_CHAPTER = `
────────────────────────────────────────
09 · Motion & Interaction 动效与交互（樱花彩虹级编排）
────────────────────────────────────────
Sakura Chroma 的动效语言是"墨纸上的彩虹戏剧"——花瓣飘落、印章砸落、缎带流光、
纸纹呼吸，像一份被风轻拂的日式版画。动效要有季节感、有手作感，但不要滑向卡通。
以下规范确保每一页进入视口时都有"被点彩过"的质感。

▎入场编排系统（Cinematic Reveal）
每个 .slide 进入视口时，子元素按"标题→副标题→正文→图表→数据条"顺序依次入场，
每层之间错开 120ms，整体在 1.2s 内完成。默认隐藏态用 opacity:0 + 多种 transform 组合：
  · class="reveal"          → opacity:0; transform:translateY(20px) （上浮，用于正文/卡片）
  · class="reveal reveal-scale"  → opacity:0; transform:scale(0.94) （缩放，用于图表/SVG 容器）
  · class="reveal reveal-blur"   → opacity:0; transform:translateY(16px); filter:blur(6px) （模糊聚焦，用于 hero 标题）
  · class="reveal reveal-slide-l" → opacity:0; transform:translateX(-24px) （左滑，用于左侧分栏）
  · class="reveal reveal-slide-r" → opacity:0; transform:translateX(24px) （右滑，用于右侧分栏）
进入视口后：
  · .slide.is-visible .reveal → opacity:1; transform:none; filter:none;
    transition: opacity .7s cubic-bezier(0.16,1,0.3,1), transform .7s cubic-bezier(0.16,1,0.3,1), filter .7s ease
  · 延迟阶梯：reveal-d1(0s) / reveal-d2(.12s) / reveal-d3(.24s) / reveal-d4(.36s) / reveal-d5(.48s) / reveal-d6(.6s)
  · 触发：页尾 <script> 用 IntersectionObserver（threshold:0.18）给 .slide 加 .is-visible，一次性 unobserve

▎封面签名动效（Signature Animation — 花瓣飘落 + 印章砸落 + 缎带流光）
封面是樱花彩虹的第一印象，动效比内页重 3 倍：
  · 花瓣簇 petal-fall：@keyframes petal-fall 多片花瓣（6 色彩虹各 2-3 片）从顶部飘落，
    translateY(-50px→720px) + rotate(0→360deg) + translateX 随机偏移，4-6s linear infinite，错相位
  · 12 角星芒印章 stamp-drop：@keyframes stamp-drop 从 scale(1.5) + rotate(-15deg) + opacity:0
    → scale(1) + rotate(-8deg) + opacity:1，0.6s cubic-bezier(0.34,1.56,0.64,1)，砸落后定格
  · 彩虹缎带 rainbow-shimmer：6 色缎带 background-position 横向流动，
    @keyframes shimmer background-position 0→200%，3s linear infinite
  · 封面 hero 标题：reveal-blur 整体入场（opacity:0 + translateY(16px) + blur(6px) → opacity:1 + none），
    不要用 JS 拆字逐字入场
  · 封面副标题：标题完成后 0.3s，reveal-slide-l 入场
  · 底部 colophon 数据：count-up 动画

▎数字滚动动画（Count-Up — 用于所有数据条 / 数字展示）
  · 带 data-num 属性的元素，进入视口时从 0 滚动到目标值，1.8s ease-out
  · JS：requestAnimationFrame 插值，支持整数和小数（1 位小数）
  · 千分位用逗号格式化
  · 示例：<span class="metric-num" data-num="1280000">0</span>

▎SVG 图表高级绘制（彩虹数据条 + 等宽序列）
  · 6 色数据条带：每条 clip-path 从 width:0→width:100%，1.2s，按彩虹顺序依次延迟 0.15s
  · 像素阶梯 / 几何装饰：stroke-dashoffset 全长→0，2s cubic-bezier(0.16,1,0.3,1)
  · 散点 / 圆点序列：scale(0→1) + opacity(0→1)，0.4s，stagger 0.08s
  · 引用页大引号：scale(0.8→1) + rotate(-5deg→0)，0.6s，缓动略带弹性
  · 所有 SVG 动画在 slide 可见时由 JS 添加 .is-animated class 触发

▎视差效果（Parallax — 花瓣与背景纸纹分层飘动）
  · 背景半色调纸纹：translateY 按滚动比例的 0.15 倍移动（极轻，纸纹不该抢戏）
  · 装饰花瓣层：translateY 按滚动比例的 0.4 倍移动（前景花瓣更活跃）
  · JS：scroll 事件 + rAF，计算 slide 在视口中的偏移比例，设置 CSS 变量 --parallax
  · CSS：.parallax-petal { transform: translateY(var(--parallax, 0px)) }
  · 每页最多 1 个视差层

▎页面转场（Slide Transition）
  · .slide 之间用 24px gap + 背景色过渡，不要硬切
  · 上一页离开视口时：opacity 渐变到 0.6
  · 当前页进入时：opacity 0.4→1，0.5s

▎光标跟随效果（Cursor Spotlight — 仅封面）
  · 封面背景有一个 radial-gradient 跟随鼠标位置的光斑（棕墨色，极淡）
  · JS：mousemove 更新 CSS 变量 --cursor-x / --cursor-y
  · CSS：background-image: radial-gradient(280px circle at var(--cursor-x,50%) var(--cursor-y,50%), rgba(58,37,22,0.05), transparent 70%)
  · 必须用 transparent 70% 终止（不能只写 transparent），否则渐变会延伸到角落，整个封面被淡色雾覆盖，parchment 底色被遮住
  · 必须用 background-image 属性（不能是 background shorthand），否则会覆盖 .slide 的 background-color，导致封面失去容器底色、透出 body 灰底
  · 离开封面区域时光斑淡出

▎悬停微交互（Hover Micro-Interaction）
  · 数据条：hover 时彩虹缎带 shimmer 加速 + 轻微 translateY(-3px)，0.25s
  · 印章元素：hover 时 stamp-drop 重播一次（0.6s）
  · 引用块：hover 时大引号 scale(1.05)，0.3s
  · 可点击元素：hover cursor:pointer + 背景色过渡

▎呼吸感（Ambient Breathing — 半色调纸纹 + 花瓣轻颤）
  · 半色调纸纹 halftone-breathe：@keyframes breathe opacity(0.12→0.18→0.12) 5s ease-in-out infinite
  · 装饰花瓣：@keyframes sway rotate(-3deg→3deg→-3deg) 6s ease-in-out infinite（极轻微摇摆）
  · 每页最多 2 个呼吸元素，避免视觉嘈杂

约束：
  · 不引入外部 JS 库（GSAP/Motion 等），只用原生 CSS @keyframes + IntersectionObserver + requestAnimationFrame
  · 全部动效在 <style> 和 <script> 内，不外链
  · 脚本总量不超过 120 行 vanilla JS
  · @media (prefers-reduced-motion: reduce) 关闭所有动画，.reveal 直接 opacity:1 transform:none filter:none
  · 性能：只用 transform / opacity / filter / clip-path 做动画，不触发 layout
  · 每页入场总时长不超过 1.5s
  · 层叠上下文：每个 .slide 必须 isolation:isolate，防止 filter:blur() / transform 溢出影响相邻 slide
  · 文字不换行：多行标题不要用 JS 拆字逐字入场，改用 reveal-blur 整体入场
  · SVG 边界安全：所有 SVG 内部元素坐标 + 尺寸必须落在 viewBox 范围内；text 元素需留 ≥4px 安全余量；SVG width 用 "100%"
  · 樱花场景特有：6 色彩虹仅用于装饰缎带/印章/数据条动效，不在正文文字上使用；花瓣飘落数量每页不超过 8 片，避免遮挡内容
  · 半色调纸纹 opacity 上限 0.18，超过会让奶油底发灰
  · SVG marker 引用：使用 marker-end="url(#id)" 前，必须在 SVG 内 <defs> 中定义 <marker>，否则箭头不显示。标准 marker 定义：
    <defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M1 1 L7 4 L1 7 Z" fill="#999"/></marker></defs>
    fill 颜色按本模板的轴线/辅助线色设置（Kami 用 #ddd9cc，deck-report 用 #e5e7eb，cobalt-grid 用 #1F2BE0，bloomberg 用 #1F3A5F 等）
  · bar-anim 一致性：同一图表内所有柱子必须统一使用 bar-anim class + bar-dN 延迟，禁止部分柱子有动画部分没有
  · 环形图 stroke-dasharray 必须 = 2πr（周长公式），stroke-dashoffset 目标 = C × (1 - 比例)
  · 折线图 line-anim 的 stroke-dasharray 必须等于实际路径长度（不是固定数值）`;

const SAKURA_CHROMA_MOTION_ANTI_PATTERNS = `✗ 引入 GSAP / Motion / 外部动画库
✗ 动效无 prefers-reduced-motion 降级
✗ 6 色彩虹用在正文文字上（仅限装饰缎带/印章/数据条）
✗ 花瓣飘落数量超过 8 片/页（遮挡内容）
✗ 半色调纸纹 opacity 超过 0.18（奶油底发灰）
✗ 印章砸落用柔软缓动（应用 cubic-bezier(0.34,1.56,0.64,1) 略带弹性）
`;

/** Motion sakura-chroma prompt = static prompt + Motion chapter + motion anti-patterns. */
const SAKURA_CHROMA_MOTION_PROMPT = `${TEMPLATE_SELECTION_GUIDE}
${SAKURA_CHROMA_PROMPT}
${SAKURA_CHROMA_MOTION_CHAPTER}
────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
${SAKURA_CHROMA_MOTION_ANTI_PATTERNS}
────────────────────────────────────────
组织方式
────────────────────────────────────────
约 8 页：cover / manifesto / catalogue / stripe-data / quote / schedule / colophon，每页固定 1280×720，信息密度高、版面布满。`;

/* ============================================================
 * cobalt-grid — 钴蓝网格（电光钴蓝 #1F2BE0 + 象牙纸）
 * ============================================================ */

/** Static cobalt-grid prompt. */
const COBALT_GRID_PROMPT = `用 Cobalt Grid 设计语言帮我把内容排成一份演示稿（主题与内容我会另行提供，或见下文）。
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
约 8 页：cover / manifesto / index / chapter / data / quote / table / colophon，每页固定 1280×720，信息密度高、版面布满。`;

/** Motion chapter appended to the cobalt-grid static prompt. */
const COBALT_GRID_MOTION_CHAPTER = `
────────────────────────────────────────
09 · Motion & Interaction 动效与交互（钴蓝网格级编排）
────────────────────────────────────────
Cobalt Grid 的动效语言是"方格纸上的电路绘制"——网格扩散、QR 闪烁、像素阶梯逐级点亮，
像一份正在被电光扫描的工程蓝图。动效要有数字感、有秩序感，但不要变成赛博朋克。
以下规范确保每一页进入视口时都有"被扫描过"的质感。

▎入场编排系统（Cinematic Reveal）
每个 .slide 进入视口时，子元素按"标题→副标题→正文→图表→数据块"顺序依次入场，
每层之间错开 120ms，整体在 1.2s 内完成。默认隐藏态用 opacity:0 + 多种 transform 组合：
  · class="reveal"          → opacity:0; transform:translateY(20px) （上浮，用于正文/卡片）
  · class="reveal reveal-scale"  → opacity:0; transform:scale(0.94) （缩放，用于图表/SVG 容器）
  · class="reveal reveal-blur"   → opacity:0; transform:translateY(16px); filter:blur(6px) （模糊聚焦，用于 hero 标题）
  · class="reveal reveal-slide-l" → opacity:0; transform:translateX(-24px) （左滑，用于左侧分栏）
  · class="reveal reveal-slide-r" → opacity:0; transform:translateX(24px) （右滑，用于右侧分栏）
进入视口后：
  · .slide.is-visible .reveal → opacity:1; transform:none; filter:none;
    transition: opacity .7s cubic-bezier(0.16,1,0.3,1), transform .7s cubic-bezier(0.16,1,0.3,1), filter .7s ease
  · 延迟阶梯：reveal-d1(0s) / reveal-d2(.12s) / reveal-d3(.24s) / reveal-d4(.36s) / reveal-d5(.48s) / reveal-d6(.6s)
  · 触发：页尾 <script> 用 IntersectionObserver（threshold:0.18）给 .slide 加 .is-visible，一次性 unobserve

▎封面签名动效（Signature Animation — 网格扩散 + QR 闪烁 + 像素阶梯）
封面是钴蓝网格的第一印象，动效比内页重 3 倍：
  · graph-paper 网格 grid-expand：@keyframes grid-expand 从中心向外扩散，
    background-size 0→100%，1.2s cubic-bezier(0.16,1,0.3,1)，网格线像被电光扫描画出
  · QR 块 qr-blink：@keyframes qr-blink 多个钴蓝方块逐格亮起，
    opacity(0→1) + scale(0.5→1)，0.3s/格，stagger 0.04s，形成扫描轨迹
  · 像素阶梯 line-anim：stroke-dashoffset 全长→0，2s cubic-bezier(0.16,1,0.3,1)，
    阶梯像被逐级点亮
  · 封面 hero 标题：reveal-blur 整体入场（opacity:0 + translateY(16px) + blur(6px) → opacity:1 + none），
    不要用 JS 拆字逐字入场
  · 封面副标题：标题完成后 0.3s，reveal-slide-l 入场
  · 底部 mono 页码：count-up 或逐字 reveal

▎数字滚动动画（Count-Up — 用于所有 mono 数据 / 编号）
  · 带 data-num 属性的元素，进入视口时从 0 滚动到目标值，1.8s ease-out
  · JS：requestAnimationFrame 插值，支持整数和小数（1 位小数）
  · 千分位用逗号格式化，mono 字体 + tabular-nums
  · 示例：<span class="metric-num" data-num="1280000">0</span>

▎SVG 图表高级绘制（像素阶梯 + 钴蓝条形 + 网格图）
  · 像素阶梯 / 折线：stroke-dashoffset 全长→0，2s cubic-bezier(0.16,1,0.3,1)，绘制后保持
  · 钴蓝条形图：每根柱子 clip-path 从 height:0→height:100%（自下而上），0.8s，依次延迟 0.1s
  · QR 矩阵 / 网格图：单元格逐个 opacity(0→1) + scale(0.5→1)，0.3s/格，stagger 0.04s
  · 数据点圆点：在线条绘制完成后依次弹出，scale(0→1) + opacity(0→1)，0.4s，stagger 0.08s
  · 所有 SVG 动画在 slide 可见时由 JS 添加 .is-animated class 触发

▎视差效果（Parallax — 网格背景与前景分层）
  · 背景 graph-paper 网格：translateY 按滚动比例的 0.2 倍移动（网格作为底层缓慢移动）
  · 前景内容：正常滚动
  · JS：scroll 事件 + rAF，计算 slide 在视口中的偏移比例，设置 CSS 变量 --parallax
  · CSS：.parallax-grid { transform: translateY(var(--parallax, 0px)) }
  · 每页最多 1 个视差元素

▎页面转场（Slide Transition）
  · .slide 之间用 24px gap + 背景色过渡，不要硬切
  · 上一页离开视口时：opacity 渐变到 0.6
  · 当前页进入时：opacity 0.4→1，0.5s

▎光标跟随效果（Cursor Spotlight — 仅封面）
  · 封面背景有一个 radial-gradient 跟随鼠标位置的光斑（钴蓝电光感）
  · JS：mousemove 更新 CSS 变量 --cursor-x / --cursor-y
  · CSS：background-image: radial-gradient(300px circle at var(--cursor-x,50%) var(--cursor-y,50%), rgba(31,43,224,0.08), transparent 70%)
  · 必须用 transparent 70% 终止（不能只写 transparent），否则渐变会延伸到角落，整个封面被淡色雾覆盖，parchment 底色被遮住
  · 必须用 background-image 属性（不能是 background shorthand），否则会覆盖 .slide 的 background-color，导致封面失去容器底色、透出 body 灰底
  · 离开封面区域时光斑淡出

▎悬停微交互（Hover Micro-Interaction）
  · QR 块 / 网格格子：hover 时 scale(1.1) + 钴蓝加亮，0.2s
  · 钴蓝条形图：hover 时 stroke-width / 高度微增 + 显示数值 tooltip
  · 像素阶梯节点：hover 时 scale(1.2) + 钴蓝发光（box-shadow 0 0 8px rgba(31,43,224,0.4)），0.25s
  · 可点击元素：hover cursor:pointer + 背景色过渡

▎呼吸感（Ambient Breathing — 网格脉动 + 电光呼吸）
  · 关键 QR 块 / 焦点格子：@keyframes pulse opacity(0.7→1→0.7) 3s ease-in-out infinite
  · 钴蓝强调点：@keyframes glow box-shadow 0 0 4px→0 0 8px rgba(31,43,224,0.4)→0 0 4px，4s ease-in-out infinite
  · 每页最多 2 个呼吸元素，避免视觉嘈杂

约束：
  · 不引入外部 JS 库（GSAP/Motion 等），只用原生 CSS @keyframes + IntersectionObserver + requestAnimationFrame
  · 全部动效在 <style> 和 <script> 内，不外链
  · 脚本总量不超过 120 行 vanilla JS
  · @media (prefers-reduced-motion: reduce) 关闭所有动画，.reveal 直接 opacity:1 transform:none filter:none
  · 性能：只用 transform / opacity / filter / clip-path 做动画，不触发 layout
  · 每页入场总时长不超过 1.5s
  · 层叠上下文：每个 .slide 必须 isolation:isolate，防止 filter:blur() / transform 溢出影响相邻 slide
  · 文字不换行：多行标题不要用 JS 拆字逐字入场，改用 reveal-blur 整体入场
  · SVG 边界安全：所有 SVG 内部元素坐标 + 尺寸必须落在 viewBox 范围内；text 元素需留 ≥4px 安全余量；SVG width 用 "100%"
  · 网格场景特有：graph-paper 网格背景动效 opacity 上限 0.10，超过会盖住象牙纸底色；QR 闪烁每页格子数不超过 30 个，避免性能与视觉过载
  · 钴蓝占比：动效中钴蓝 #1F2BE0 占面积不超过 10%，与静态规范一致
  · SVG marker 引用：使用 marker-end="url(#id)" 前，必须在 SVG 内 <defs> 中定义 <marker>，否则箭头不显示。标准 marker 定义：
    <defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M1 1 L7 4 L1 7 Z" fill="#999"/></marker></defs>
    fill 颜色按本模板的轴线/辅助线色设置（Kami 用 #ddd9cc，deck-report 用 #e5e7eb，cobalt-grid 用 #1F2BE0，bloomberg 用 #1F3A5F 等）
  · bar-anim 一致性：同一图表内所有柱子必须统一使用 bar-anim class + bar-dN 延迟，禁止部分柱子有动画部分没有
  · 环形图 stroke-dasharray 必须 = 2πr（周长公式），stroke-dashoffset 目标 = C × (1 - 比例)
  · 折线图 line-anim 的 stroke-dasharray 必须等于实际路径长度（不是固定数值）`;

const COBALT_GRID_MOTION_ANTI_PATTERNS = `✗ 引入 GSAP / Motion / 外部动画库
✗ 动效无 prefers-reduced-motion 降级
✗ graph-paper 网格动效 opacity 超过 0.10（盖住象牙纸底色）
✗ QR 闪烁格子数超过 30 个/页（性能与视觉过载）
✗ 钴蓝动效占面积超过 10%
✗ 用渐变或彩色填充（钴蓝网格应为实色 + 线条）
`;

/** Motion cobalt-grid prompt = static prompt + Motion chapter + motion anti-patterns. */
const COBALT_GRID_MOTION_PROMPT = `${TEMPLATE_SELECTION_GUIDE}
${COBALT_GRID_PROMPT}
${COBALT_GRID_MOTION_CHAPTER}
────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
${COBALT_GRID_MOTION_ANTI_PATTERNS}
────────────────────────────────────────
组织方式
────────────────────────────────────────
约 8 页：cover / manifesto / index / chapter / data / quote / table / colophon，每页固定 1280×720，信息密度高、版面布满。`;

/* ============================================================
 * brutalist-newspaper — 报章砸落（spot-red #C8102E + ink #1a1a1a，硬切）
 * ============================================================ */

/** Static brutalist-newspaper prompt. */
const BRUTALIST_NEWSPAPER_PROMPT = `用「Brutalist 报章风」设计语言帮我把内容排成一份演示稿（主题与内容我会另行提供，或见下文）。
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
约 10 页：cover / headline / data / quote / feature / timeline / matrix / sidebar / closing / colophon，每页固定 1280×720，信息密度极高、版面像报纸一样布满，遵循以上全部规范。`;

/** Motion chapter appended to the brutalist-newspaper static prompt. */
const BRUTALIST_NEWSPAPER_MOTION_CHAPTER = `
────────────────────────────────────────
09 · Motion & Interaction 动效与交互（报章砸落级编排）
────────────────────────────────────────
Brutalist 报章风的动效语言是"印刷机的暴力美学"——砸落、裁切、旋转定格、网点渐显，
像一份正在被高速印刷的报纸。动效要硬、要快、要有机械感，禁止任何柔软缓动。
以下规范确保每一页进入视口时都有"被印刷机压过"的质感。

▎入场编排系统（Cinematic Reveal — 硬切风格）
每个 .slide 进入视口时，子元素按"kicker→headline→lead→多栏正文→图"顺序依次入场，
每层之间错开 80ms（比标准更紧凑，符合印刷节奏），整体在 1.0s 内完成。
默认隐藏态用 opacity:0 + 多种 transform 组合，缓动统一硬切：
  · class="reveal"          → opacity:0; transform:translateY(20px) （上浮，用于正文/栏）
  · class="reveal reveal-scale"  → opacity:0; transform:scale(0.94) （缩放，用于图/表）
  · class="reveal reveal-slide-l" → opacity:0; transform:translateX(-24px) （左滑，用于左栏）
  · class="reveal reveal-slide-r" → opacity:0; transform:translateX(24px) （右滑，用于右栏）
  · class="reveal reveal-clip"    → opacity:0; clip-path:inset(0 100% 0 0) （横向裁切，用于 pull quote / 标题）
进入视口后：
  · .slide.is-visible .reveal → opacity:1; transform:none; clip-path:inset(0);
    transition: opacity .5s cubic-bezier(0.7,0,0.3,1), transform .5s cubic-bezier(0.7,0,0.3,1), clip-path .5s cubic-bezier(0.7,0,0.3,1)
  · 延迟阶梯：reveal-d1(0s) / reveal-d2(.08s) / reveal-d3(.16s) / reveal-d4(.24s) / reveal-d5(.32s) / reveal-d6(.4s)
  · 触发：页尾 <script> 用 IntersectionObserver（threshold:0.2）给 .slide 加 .is-visible，一次性 unobserve
  · 禁止使用 cubic-bezier(0.16,1,0.3,1) 柔软缓动；禁止使用 ease / ease-out

▎封面签名动效（Signature Animation — Drop Cap 砸落 + Stamp 旋转定格 + Halftone 渐显）
封面是报章的第一印象，动效比内页重 3 倍：
  · Masthead 报头：reveal-clip 从左到右裁切揭示，0.6s cubic-bezier(0.7,0,0.3,1)，像被印刷机压出
  · Drop cap drop-cap-slam：@keyframes drop-cap-slam 从 scale(2) + translateY(-40px) + opacity:0
    → scale(1) + translateY(0) + opacity:1，0.4s cubic-bezier(0.7,0,0.3,1)，硬砸落定格式：
    transform-origin:top left，不要弹性回弹
  · Stamp stamp-rotate：@keyframes stamp-rotate 从 scale(1.4) + rotate(-25deg) + opacity:0
    → scale(1) + rotate(-8deg) + opacity:1，0.3s steps(3)，旋转定格，像盖章机械感
  · Halftone 图 halftone-reveal：@keyframes halftone-reveal opacity(0→1) + filter:contrast(2→1.15)，
    0.8s steps(4)，网点渐显像油墨渗透
  · 封面 headline：reveal-clip 整体入场，不要用 JS 拆字逐字入场
  · 底部 mono 期号 + 日期：reveal-fade 最后入场
  · 全篇禁止使用柔软缓动（ease / ease-out / cubic-bezier(0.16,1,0.3,1)），统一用 cubic-bezier(0.7,0,0.3,1) 或 steps()

▎数字滚动动画（Count-Up — 用于 stat block 大数字）
  · 带 data-num 属性的元素，进入视口时从 0 滚动到目标值，1.2s steps(8)（步进感，像计数器）
  · JS：requestAnimationFrame 插值，支持整数和小数（1 位小数）
  · 千分位用逗号格式化，mono 字体 + tabular-nums
  · 示例：<span class="metric-num" data-num="1280000">0</span>

▎SVG 图表高级绘制（报章数据新闻风）
  · 柱状图：每根柱子 transform:scaleY(0)→scaleY(1)，transform-origin:bottom，0.5s cubic-bezier(0.7,0,0.3,1)，依次延迟 0.08s
  · 折线图：stroke-dashoffset 全长→0，1.5s cubic-bezier(0.7,0,0.3,1)，spot-red 关键点最后 steps(2) 弹出
  · 数据矩阵：单元格逐个 opacity(0→1)，0.2s/格，stagger 0.03s，硬切无缓动
  · 时间线：1px ink 主轴 stroke-dashoffset 绘制，0.8s；圆点节点 scale(0→1) 0.2s 硬切
  · 所有 SVG 动画在 slide 可见时由 JS 添加 .is-animated class 触发

▎视差效果（Parallax — 多栏报纸滚动感）
  · 背景水印大字 / 装饰：translateY 按滚动比例的 0.25 倍移动
  · 前景多栏内容：正常滚动
  · JS：scroll 事件 + rAF，计算 slide 在视口中的偏移比例，设置 CSS 变量 --parallax
  · CSS：.parallax-bg { transform: translateY(var(--parallax, 0px)) }
  · 每页最多 1 个视差元素

▎页面转场（Slide Transition — 硬切翻页）
  · .slide 之间用 24px gap + 背景色过渡
  · 上一页离开视口时：opacity 硬切到 0.5（0.2s，不要柔和渐变）
  · 当前页进入时：opacity 0.5→1，0.3s cubic-bezier(0.7,0,0.3,1)

▎光标跟随效果（Cursor Spotlight — 仅封面）
  · 封面背景有一个 radial-gradient 跟随鼠标位置的光斑（spot-red 极淡）
  · JS：mousemove 更新 CSS 变量 --cursor-x / --cursor-y
  · CSS：background-image: radial-gradient(280px circle at var(--cursor-x,50%) var(--cursor-y,50%), rgba(200,16,46,0.04), transparent 70%)
  · 必须用 transparent 70% 终止（不能只写 transparent），否则渐变会延伸到角落，整个封面被淡色雾覆盖，parchment 底色被遮住
  · 必须用 background-image 属性（不能是 background shorthand），否则会覆盖 .slide 的 background-color，导致封面失去容器底色、透出 body 灰底
  · 离开封面区域时光斑淡出

▎悬停微交互（Hover Micro-Interaction — 硬切响应）
  · Stat block：hover 时 scale(1.05) + spot-red 高亮，0.15s 硬切（不要柔和过渡）
  · Stamp：hover 时 stamp-rotate 重播一次（0.3s steps(3)）
  · Halftone 图：hover 时 contrast 微增 + 描边加粗，0.2s
  · 可点击元素：hover cursor:pointer + 背景色硬切过渡

▎呼吸感（Ambient Breathing — 报纸印刷机脉动）
  · 关键 spot-red 焦点元素：@keyframes pulse opacity(0.8→1→0.8) 2s steps(2) infinite（步进脉动）
  · 印章边框：@keyframes flicker box-shadow 微微闪烁，3s steps(4) infinite
  · 每页最多 2 个呼吸元素，避免视觉嘈杂

约束：
  · 不引入外部 JS 库（GSAP/Motion 等），只用原生 CSS @keyframes + IntersectionObserver + requestAnimationFrame
  · 全部动效在 <style> 和 <script> 内，不外链
  · 脚本总量不超过 120 行 vanilla JS
  · @media (prefers-reduced-motion: reduce) 关闭所有动画，.reveal 直接 opacity:1 transform:none clip-path:none
  · 性能：只用 transform / opacity / filter / clip-path 做动画，不触发 layout
  · 每页入场总时长不超过 1.0s（报章节奏比其他模板更快）
  · 层叠上下文：每个 .slide 必须 isolation:isolate，防止 transform 溢出影响相邻 slide
  · 文字不换行：多行标题不要用 JS 拆字逐字入场，改用 reveal-clip 整体入场
  · SVG 边界安全：所有 SVG 内部元素坐标 + 尺寸必须落在 viewBox 范围内；text 元素需留 ≥4px 安全余量；SVG width 用 "100%"
  · 报章场景特有：禁止柔软缓动（ease / ease-out / cubic-bezier(0.16,1,0.3,1)），统一用 cubic-bezier(0.7,0,0.3,1) 或 steps()
  · spot-red 占比：动效中 spot-red #C8102E 占面积不超过 3%，与静态规范一致
  · 禁止圆角动效：所有动效元素的圆角不超过 4px，与报章方正风格一致
  · SVG marker 引用：使用 marker-end="url(#id)" 前，必须在 SVG 内 <defs> 中定义 <marker>，否则箭头不显示。标准 marker 定义：
    <defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M1 1 L7 4 L1 7 Z" fill="#999"/></marker></defs>
    fill 颜色按本模板的轴线/辅助线色设置（Kami 用 #ddd9cc，deck-report 用 #e5e7eb，cobalt-grid 用 #1F2BE0，bloomberg 用 #1F3A5F 等）
  · bar-anim 一致性：同一图表内所有柱子必须统一使用 bar-anim class + bar-dN 延迟，禁止部分柱子有动画部分没有
  · 环形图 stroke-dasharray 必须 = 2πr（周长公式），stroke-dashoffset 目标 = C × (1 - 比例)
  · 折线图 line-anim 的 stroke-dasharray 必须等于实际路径长度（不是固定数值）`;

const BRUTALIST_NEWSPAPER_MOTION_ANTI_PATTERNS = `✗ 引入 GSAP / Motion / 外部动画库
✗ 动效无 prefers-reduced-motion 降级
✗ 单页入场总时长超过 1.0s（报章节奏更快）
✗ 用柔软缓动 ease / ease-out / cubic-bezier(0.16,1,0.3,1)（报章必须硬切）
✗ Drop cap 砸落用弹性回弹（应硬砸定格）
✗ Stamp 旋转用柔和过渡（应用 steps() 机械定格）
✗ spot-red 动效占面积超过 3%
✗ 动效元素圆角超过 4px（破坏方正报章感）
✗ 用彩色或渐变动效（应 ink + spot-red 双色）
`;

/** Motion brutalist-newspaper prompt = static prompt + Motion chapter + motion anti-patterns. */
const BRUTALIST_NEWSPAPER_MOTION_PROMPT = `${TEMPLATE_SELECTION_GUIDE}
${BRUTALIST_NEWSPAPER_PROMPT}
${BRUTALIST_NEWSPAPER_MOTION_CHAPTER}
────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
✗ 纯白背景或彩色照片；✗ 渐变铺底或软投影
✗ 引入第二种彩色（红以外）；✗ 居中卡片式留白布局
✗ 大块空白未填满；✗ 合成 bold 当唯一强调手段
✗ 圆角超过 4px；✗ 半透明 rgba 叠色（应实色）
${BRUTALIST_NEWSPAPER_MOTION_ANTI_PATTERNS}
────────────────────────────────────────
组织方式
────────────────────────────────────────
约 10 页：cover / headline / data / quote / feature / timeline / matrix / sidebar / closing / colophon，每页固定 1280×720，信息密度极高、版面像报纸一样布满，遵循以上全部规范。`;

/* ============================================================
 * bloomberg-editorial — 数据新闻（bloomberg-navy #1F3A5F + amber/green）
 * ============================================================ */

/** Static bloomberg-editorial prompt. */
const BLOOMBERG_EDITORIAL_PROMPT = `用「Bloomberg / Economist 数据新闻编辑风」设计语言帮我把内容排成一份演示稿（主题与内容我会另行提供，或见下文）。
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
约 12 页：cover / editor-note / contents / data-1 / data-2 / sidebar / compare / timeline / matrix / quote / risk / closing，每页固定 1280×720，多列布局、微型图表丰富、信息密度高、版面布满，遵循以上全部规范。`;

/** Motion chapter appended to the bloomberg-editorial static prompt. */
const BLOOMBERG_MOTION_CHAPTER = `
────────────────────────────────────────
09 · Motion & Interaction 动效与交互（数据新闻级编排）
────────────────────────────────────────
Bloomberg 编辑风的动效语言是"数据被编辑审视的过程"——折线绘制、柱状生长、环形按比例停止、
桑基流线扩张，像一份正在被数据记者标注的编辑稿。动效要有新闻的克制、有数据的精确。
以下规范确保每一页进入视口时都有"被数据验证过"的质感。

▎入场编排系统（Cinematic Reveal）
每个 .slide 进入视口时，子元素按"section-label→headline→deck→多栏正文→微型图表→侧栏"顺序依次入场，
每层之间错开 110ms，整体在 1.2s 内完成。默认隐藏态用 opacity:0 + 多种 transform 组合：
  · class="reveal"          → opacity:0; transform:translateY(20px) （上浮，用于正文/栏）
  · class="reveal reveal-blur"   → opacity:0; transform:translateY(16px); filter:blur(6px) （模糊聚焦，用于 Source Serif Pro 标题）
  · class="reveal reveal-slide-l" → opacity:0; transform:translateX(-24px) （左滑，用于主栏内容）
  · class="reveal reveal-slide-r" → opacity:0; transform:translateX(24px) （右滑，用于侧栏 sidebar box）
  · class="reveal reveal-fade"    → opacity:0 （纯淡入，用于数据表格行，避免位移干扰阅读）
进入视口后：
  · .slide.is-visible .reveal → opacity:1; transform:none; filter:none;
    transition: opacity .7s cubic-bezier(0.16,1,0.3,1), transform .7s cubic-bezier(0.16,1,0.3,1), filter .7s ease
  · 延迟阶梯：reveal-d1(0s) / reveal-d2(.11s) / reveal-d3(.22s) / reveal-d4(.33s) / reveal-d5(.44s) / reveal-d6(.55s)
  · 触发：页尾 <script> 用 IntersectionObserver（threshold:0.18）给 .slide 加 .is-visible，一次性 unobserve

▎封面签名动效（Signature Animation — Masthead blur 入场 + 折线首屏绘制）
封面是数据新闻的第一印象，动效比内页重 3 倍：
  · Masthead 刊名：reveal-blur 整体入场（Source Serif Pro 标题 blur(6px) 聚焦），
    不要用 JS 拆字逐字入场——会破坏 serif 字距一致性
  · 封面 headline：masthead 完成后 0.3s，reveal-blur 入场
  · 封面 deck（副标题）：reveal-slide-l 入场，0.5s
  · 封面首屏折线图：stroke-dashoffset 全长→0，2s cubic-bezier(0.16,1,0.3,1)，
    数据点依次弹出，最后 amber 焦点点高亮
  · 底部 mono 日期 + 页码：最后 reveal-fade
  · 全篇动效克制，让数据本身成为主角

▎数字滚动动画（Count-Up — 用于所有 stat card / 数据卡）
  · 带 data-num 属性的元素，进入视口时从 0 滚动到目标值，1.6s ease-out
  · JS：requestAnimationFrame 插值，支持整数和小数（1 位小数）
  · 千分位用逗号格式化，mono 字体 + tabular-nums；同比变化箭头 ▲▼ 最后弹出
  · 示例：<span class="metric-num" data-num="1280000">0</span>

▎SVG 图表高级绘制（数据新闻微型图表群）
  · 折线图 line-anim：stroke-dashoffset 全长→0，2s cubic-bezier(0.16,1,0.3,1)，绘制后保持；
    数据点圆点在线条完成后依次弹出 scale(0→1) + opacity(0→1)，0.4s，stagger 0.08s；
    amber 焦点点最后高亮 + 文字标注
  · 柱状图 bar-anim：每根柱子 transform:scaleY(0)→scaleY(1)，transform-origin:bottom，0.8s，
    依次延迟 0.1s；amber 焦点柱最后生长 + 数值弹出
  · 环形图 stroke-dashoffset：从周长→目标比例值停止（不是全画完），1.5s ease-out；
    中心 mono 总数 count-up；navy 主段 + muted 次段
  · 桑基图 clip-path 宽度增长：流线从 width:0→width:100%（自左向右扩张），1.5s cubic-bezier(0.16,1,0.3,1)；
    节点 0.5px ink 边框最后绘出
  · 散点图：圆点 scale(0→1) + opacity(0→1)，0.3s，stagger 0.05s；amber 焦点点最后弹出
  · 热力矩阵：单元格逐个 reveal-fade，按行 stagger 0.04s
  · 所有 SVG 动画在 slide 可见时由 JS 添加 .is-animated class 触发

▎视差效果（Parallax — 背景水印大字与前景分层）
  · 背景水印大字 / 装饰：translateY 按滚动比例的 0.2 倍移动
  · 前景多栏内容：正常滚动
  · JS：scroll 事件 + rAF，计算 slide 在视口中的偏移比例，设置 CSS 变量 --parallax
  · CSS：.parallax-bg { transform: translateY(var(--parallax, 0px)) }
  · 每页最多 1 个视差元素

▎页面转场（Slide Transition）
  · .slide 之间用 24px gap + 背景色过渡，不要硬切
  · 上一页离开视口时：opacity 渐变到 0.65（保持上下文感）
  · 当前页进入时：opacity 0.45→1，0.5s

▎光标跟随效果（Cursor Spotlight — 仅封面）
  · 封面背景有一个 radial-gradient 跟随鼠标位置的光斑（navy 极淡）
  · JS：mousemove 更新 CSS 变量 --cursor-x / --cursor-y
  · CSS：background-image: radial-gradient(300px circle at var(--cursor-x,50%) var(--cursor-y,50%), rgba(31,58,95,0.05), transparent 70%)
  · 必须用 transparent 70% 终止（不能只写 transparent），否则渐变会延伸到角落，整个封面被淡色雾覆盖，parchment 底色被遮住
  · 必须用 background-image 属性（不能是 background shorthand），否则会覆盖 .slide 的 background-color，导致封面失去容器底色、透出 body 灰底
  · 离开封面区域时光斑淡出

▎悬停微交互（Hover Micro-Interaction）
  · Stat card：hover translateY(-4px) + box-shadow 加深 + 同比变化箭头加粗，0.25s
  · 数据表格行：hover 背景 #f5f5f0 高亮 + 数值 navy 加深
  · 微型图表元素：hover 时 stroke-width 加粗 + 焦点点 amber 高亮
  · Sidebar box：hover 左 2px navy 竖线显现 + 背景微变，0.2s

▎呼吸感（Ambient Breathing — 数据脉动）
  · 关键 amber/green 语义状态点：@keyframes pulse opacity(0.7→1→0.7) 3s ease-in-out infinite
  · navy 焦点数据：@keyframes subtle-glow 文字阴影微微呼吸，4s ease-in-out infinite
  · 每页最多 2 个呼吸元素，避免视觉嘈杂

约束：
  · 不引入外部 JS 库（GSAP/Motion 等），只用原生 CSS @keyframes + IntersectionObserver + requestAnimationFrame
  · 全部动效在 <style> 和 <script> 内，不外链
  · 脚本总量不超过 120 行 vanilla JS
  · @media (prefers-reduced-motion: reduce) 关闭所有动画，.reveal 直接 opacity:1 transform:none filter:none
  · 性能：只用 transform / opacity / filter / clip-path 做动画，不触发 layout
  · 每页入场总时长不超过 1.5s
  · 层叠上下文：每个 .slide 必须 isolation:isolate，防止 filter:blur() / transform 溢出影响相邻 slide
  · 文字不换行：多行标题不要用 JS 拆字逐字入场，改用 reveal-blur 整体入场
  · SVG 边界安全：所有 SVG 内部元素坐标 + 尺寸必须落在 viewBox 范围内；text 元素需留 ≥4px 安全余量；SVG width 用 "100%"
  · 数据新闻场景特有：环形图必须按比例停止（不能全画完），桑基图必须自左向右扩张（不能从中心扩散）；
    amber/green 仅用于语义状态（上升/下降/向好/警示），不作装饰动效主色
  · 微型图表密集：每页 SVG 图表可多达 4-6 个，动画 stagger 必须极小（0.04-0.08s），避免总时长超限
  · SVG marker 引用：使用 marker-end="url(#id)" 前，必须在 SVG 内 <defs> 中定义 <marker>，否则箭头不显示。标准 marker 定义：
    <defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M1 1 L7 4 L1 7 Z" fill="#999"/></marker></defs>
    fill 颜色按本模板的轴线/辅助线色设置（Kami 用 #ddd9cc，deck-report 用 #e5e7eb，cobalt-grid 用 #1F2BE0，bloomberg 用 #1F3A5F 等）
  · bar-anim 一致性：同一图表内所有柱子必须统一使用 bar-anim class + bar-dN 延迟，禁止部分柱子有动画部分没有
  · 环形图 stroke-dasharray 必须 = 2πr（周长公式），stroke-dashoffset 目标 = C × (1 - 比例)
  · 折线图 line-anim 的 stroke-dasharray 必须等于实际路径长度（不是固定数值）`;

const BLOOMBERG_MOTION_ANTI_PATTERNS = `✗ 引入 GSAP / Motion / 外部动画库
✗ 动效无 prefers-reduced-motion 降级
✗ 环形图全画完（应按比例停止）
✗ 桑基图从中心扩散（应自左向右扩张）
✗ amber/green 当作装饰动效主色（仅限语义状态）
✗ 微型图表动画 stagger 过大导致总时长超限（应 0.04-0.08s）
`;

/** Motion bloomberg-editorial prompt = static prompt + Motion chapter + motion anti-patterns. */
const BLOOMBERG_MOTION_PROMPT = `${TEMPLATE_SELECTION_GUIDE}
${BLOOMBERG_EDITORIAL_PROMPT}
${BLOOMBERG_MOTION_CHAPTER}
────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
✗ 纯白背景或彩色照片；✗ 渐变铺底或软投影
✗ 居中卡片式留白布局；✗ 大块空白未填满
✗ 合成 bold 当唯一强调；✗ 引入 navy/amber/green 以外的彩色
✗ 圆角超过 4px；✗ 表格用 rgba 透明色（应实色）
${BLOOMBERG_MOTION_ANTI_PATTERNS}
────────────────────────────────────────
组织方式
────────────────────────────────────────
约 12 页：cover / editor-note / contents / data-1 / data-2 / sidebar / compare / timeline / matrix / quote / risk / closing，每页固定 1280×720，多列布局、微型图表丰富、信息密度高、版面布满，遵循以上全部规范。`;

/* ============================================================
 * resume — A4 简历（Kami Ink Blue #1B365D，克制为主）
 * ============================================================ */

/** Static resume prompt — extracted from inline. */
const RESUME_PROMPT = `用官方 Kami 设计系统帮我排一份中文个人简历，输出自包含 HTML。
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

每个 section 标题用油墨蓝左竖线；通篇克制留白、衬线撑层级。改完务必核对：严格 2 页、不溢出。`;

/** Motion chapter appended to the resume static prompt. */
const RESUME_MOTION_CHAPTER = `
────────────────────────────────────────
09 · Motion & Interaction 动效与交互（极简简历级编排）
────────────────────────────────────────
简历是 A4 doc 类型，动效的核心是"克制"——不是电影级编排，而是"页面被打开时，
关键信息被温和地揭示"。简历阅读场景是 HR 5 秒扫视，动效不能拖延阅读。
以下规范确保简历打开时，姓名、4 数字、项目卡依次温和入场，整体在 1.2s 内完成。

▎入场编排系统（Cinematic Reveal — 极简）
A4 doc 不分 slide，整页用 IntersectionObserver（threshold:0.05）一次性触发 .is-visible。
子元素按"姓名→英文别名→4 数字→个人简介→工作经历→项目卡→核心能力→教育背景"顺序依次入场，
每层之间错开 100ms，整体在 1.2s 内完成。位移幅度极小（≤16px），避免 A4 排版错位：
  · class="reveal"          → opacity:0; transform:translateY(14px) （上浮，用于正文/卡片）
  · class="reveal reveal-blur"   → opacity:0; transform:translateY(12px); filter:blur(4px) （模糊聚焦，仅用于姓名；blur 不超过 4px）
  · class="reveal reveal-fade"    → opacity:0 （纯淡入，用于 metric 数字 / tag，避免位移干扰阅读）
  · class="reveal reveal-slide-l" → opacity:0; transform:translateX(-14px) （左滑，用于左侧时间线竖线）
进入视口后：
  · .resume.is-visible .reveal → opacity:1; transform:none; filter:none;
    transition: opacity .6s cubic-bezier(0.16,1,0.3,1), transform .6s cubic-bezier(0.16,1,0.3,1), filter .6s ease
  · 延迟阶梯：reveal-d1(0s) / reveal-d2(.1s) / reveal-d3(.2s) / reveal-d4(.3s) / reveal-d5(.4s) / reveal-d6(.5s)
  · 触发：页尾 <script> 用 IntersectionObserver（threshold:0.05）给 .resume 加 .is-visible，一次性 unobserve

▎封面签名动效（Signature Animation — 姓名 blur 聚焦 + 4 数字 count-up）
姓名是简历的第一印象，动效极简：
  · 姓名 reveal-blur 整体入场（opacity:0 + translateY(12px) + blur(4px) → opacity:1 + none），0.7s
    不要用 JS 拆字逐字入场——会破坏 serif 字距一致性
  · 英文别名：姓名完成后 0.2s，reveal-fade 入场
  · 4 个 metric 数字：count-up 动画（见下文），stagger 0.1s
  · 个人简介：reveal-fade 入场
  · 全篇禁止使用旋转、彩色脉冲、视差、光标光斑等"炫技"动效——简历要稳

▎数字滚动动画（Count-Up — 用于 4 个 metric 数字）
  · 带 data-num 属性的元素，进入视口时从 0 滚动到目标值，1.4s ease-out（庄重感）
  · JS：requestAnimationFrame 插值，支持整数和小数（1 位小数）
  · 千分位用逗号格式化，serif 字体 + tabular-nums
  · 示例：<span class="metric-num" data-num="1280000">0</span>

▎项目卡依次入场（Project Card Cascade）
  · 工作经历下的项目卡：reveal-slide-l + 0.08s stagger，每张卡间隔 80ms
  · 卡片入场时左侧 2.5pt Ink Blue 竖线同步 reveal-slide-l 从 -14px 到 0
  · 项目内三段式（角色 / 动作 / 结果）保持静态，不做内部动画
  · 卡片之间不要重叠 / 错位，A4 排版必须严格保持

▎页面转场（Slide Transition — 不适用）
  · A4 doc 为单页（或严格 2 页），不使用 slide 转场
  · 第 2 页（如有）用 reveal-fade 入场，不要硬切

约束：
  · 不引入外部 JS 库（GSAP/Motion 等），只用原生 CSS @keyframes + IntersectionObserver + requestAnimationFrame
  · 全部动效在 <style> 和 <script> 内，不外链
  · 脚本总量不超过 60 行 vanilla JS（count-up + IntersectionObserver 即可，不要 parallax / cursor spotlight）
  · @media (prefers-reduced-motion: reduce) 关闭所有动画，.reveal 直接 opacity:1 transform:none filter:none
  · 性能：只用 transform / opacity / filter 做动画，不触发 layout
  · 入场总时长不超过 1.2s，避免 HR 阅读等待
  · 简历特有约束（极简）：
    · 禁止 cursor-spotlight / parallax / ambient breathing 等持续动效——简历是阅读场景，不是演示场景
    · transform 位移幅度 ≤16px（避免 A4 排版错位）
    · filter:blur() ≤4px（避免姓名溢出遮盖）
    · 全篇动效极简：只用 reveal-fade + reveal-blur（姓名）+ count-up，不要旋转、脉冲、彩色动画
    · 不用 JS 拆字逐字入场（serif 字距一致性）
  · SVG marker 引用：使用 marker-end="url(#id)" 前，必须在 SVG 内 <defs> 中定义 <marker>，否则箭头不显示。标准 marker 定义：
    <defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M1 1 L7 4 L1 7 Z" fill="#999"/></marker></defs>
    fill 颜色按本模板的轴线/辅助线色设置（Kami 用 #ddd9cc，deck-report 用 #e5e7eb，cobalt-grid 用 #1F2BE0，bloomberg 用 #1F3A5F 等）
  · 环形图 stroke-dasharray 必须 = 2πr（周长公式），stroke-dashoffset 目标 = C × (1 - 比例）
  · 折线图 line-anim 的 stroke-dasharray 必须等于实际路径长度（不是固定数值）`;

const RESUME_MOTION_ANTI_PATTERNS = `✗ 引入 GSAP / Motion / 外部动画库
✗ 动效无 prefers-reduced-motion 降级
✗ 动画触发 layout / reflow（只允许 transform/opacity/filter）
✗ 入场总时长超过 1.2s（HR 阅读等待）
✗ 用 JS 拆字逐字入场（serif 字距一致性）
✗ 使用 cursor-spotlight / parallax / ambient breathing 等持续动效（简历是阅读场景）
✗ transform 位移超过 16px（A4 排版错位）
✗ filter:blur() 超过 4px（姓名溢出遮盖）
✗ 使用旋转、彩色脉冲、彩色动画（简历要稳）
✗ 使用 slide 转场 / 硬切（A4 doc 不适用）
✗ 脚本超过 60 行（简历场景 count-up + IntersectionObserver 即可）
`;

/** Motion resume prompt = static prompt + Motion chapter + motion anti-patterns. */
const RESUME_MOTION_PROMPT = `${TEMPLATE_SELECTION_GUIDE}
${RESUME_PROMPT}
${RESUME_MOTION_CHAPTER}
────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
${RESUME_MOTION_ANTI_PATTERNS}
────────────────────────────────────────
组织方式
────────────────────────────────────────
A4 竖版严格 2 页，按"抬头→4 数字→简介→工作经历→第 2 页：版图 / 判断 / 影响力 / 能力 / 教育"组织。
屏幕预览 body max-width:210mm；动效极简克制，姓名 blur 聚焦 + 4 数字 count-up + 项目卡依次入场，遵循以上全部规范。`;

/* ============================================================
 * deck-classic — GitHub 暗色 / 终端 IDE（Terminal Orange #f78166）
 * ============================================================ */

/** Static deck-classic prompt — extracted from inline. */
const DECK_CLASSIC_PROMPT = `用「GitHub 暗色 / 终端 IDE」视觉风格帮我把内容排成一份演示稿（主题与内容我会另行提供）。
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
每页都是 titlebar + body + footer 三段式，固定 1280×720，信息密度高、版面布满，遵循以上全部规范。`;

/** Motion chapter appended to the deck-classic static prompt. */
const DECK_CLASSIC_MOTION_CHAPTER = `
────────────────────────────────────────
09 · Motion & Interaction 动效与交互（终端 IDE 级编排）
────────────────────────────────────────
Deck Classic 的动效语言是"IDE 在被使用的过程"——titlebar 打字机、代码块逐行揭示、
光标闪烁、金句条横向裁切，像一份正在被终端执行的演示稿。动效要有机械感、有终端感。
以下规范确保每一页进入视口时都有"被运行过"的质感。

▎入场编排系统（Cinematic Reveal）
每个 .slide 进入视口时，子元素按"titlebar→kicker→page-title→page-lead→body→代码框→footer"顺序依次入场，
每层之间错开 100ms，整体在 1.2s 内完成。默认隐藏态用 opacity:0 + 多种 transform 组合：
  · class="reveal"          → opacity:0; transform:translateY(20px) （上浮，用于正文/卡片）
  · class="reveal reveal-slide-l" → opacity:0; transform:translateX(-24px) （左滑，用于左侧叙述）
  · class="reveal reveal-slide-r" → opacity:0; transform:translateX(24px) （右滑，用于右侧代码框）
  · class="reveal reveal-fade"    → opacity:0 （纯淡入，用于 metric 数字 / footer，避免位移干扰阅读）
进入视口后：
  · .slide.is-visible .reveal → opacity:1; transform:none;
    transition: opacity .6s cubic-bezier(0.16,1,0.3,1), transform .6s cubic-bezier(0.16,1,0.3,1)
  · 延迟阶梯：reveal-d1(0s) / reveal-d2(.1s) / reveal-d3(.2s) / reveal-d4(.3s) / reveal-d5(.4s) / reveal-d6(.5s)
  · 触发：页尾 <script> 用 IntersectionObserver（threshold:0.2）给 .slide 加 .is-visible，一次性 unobserve

▎封面签名动效（Signature Animation — Titlebar 打字机 + 代码块逐行 + 金句条裁切）
封面是终端 IDE 的第一印象，动效比内页重 3 倍：
  · Titlebar 打字机 typewriter：文件路径 ~/dir/file.md 逐字打出，
    @keyframes typing steps(N) 0.05s/字，硬切打字感，0.8s 完成；不要用 ease 柔和过渡
  · 交通灯圆点：依次亮起 red→yellow→green，0.15s 间隔，scale(0→1) steps(2)
  · 封面 hero 标题：reveal-slide-l 整体入场（不要拆字逐字）
  · 代码块 code-line-reveal：每行依次 opacity(0→1) + translateX(-8px→0)，
    0.04s/行 stagger，steps(2) 硬切，模拟逐行渲染
  · 光标 cursor-blink：@keyframes blink opacity(1→0→1) 1s steps(2) infinite，橙色方块
  · 金句条 golden-slash：clip-path 从 inset(0 100% 0 0)→inset(0)，0.6s steps(4)，横向裁切入场
  · 底部 footer 页码：最后 reveal-fade
  · 全篇禁止使用旋转、模糊、彩色脉冲等"花哨"动效——终端要稳

▎数字滚动动画（Count-Up — 用于 metric 数字）
  · 带 data-num 属性的元素，进入视口时从 0 滚动到目标值，1.4s ease-out
  · JS：requestAnimationFrame 插值，支持整数和小数（1 位小数）
  · 千分位用逗号格式化，mono 字体 + tabular-nums
  · 示例：<span class="metric-num" data-num="1280000">0</span>

▎SVG 图表高级绘制（终端风数据图）
  · 柱状图：每根柱子 transform:scaleY(0)→scaleY(1)，transform-origin:bottom，0.6s steps(4)，依次延迟 0.1s
  · 折线图：stroke-dashoffset 全长→0，1.5s cubic-bezier(0.16,1,0.3,1)；橙色焦点段最后绘制
  · 数据矩阵：单元格逐个 opacity(0→1)，0.15s/格，stagger 0.04s，硬切
  · 节点 / 箭头：节点 scale(0→1) steps(2)，箭头 stroke-dashoffset 绘制
  · 所有 SVG 动画在 slide 可见时由 JS 添加 .is-animated class 触发

▎视差效果（Parallax — 终端背景滚动）
  · 背景噪点纹理 / 装饰：translateY 按滚动比例的 0.2 倍移动
  · 前景内容：正常滚动
  · JS：scroll 事件 + rAF，计算 slide 在视口中的偏移比例，设置 CSS 变量 --parallax
  · CSS：.parallax-bg { transform: translateY(var(--parallax, 0px)) }
  · 每页最多 1 个视差元素

▎页面转场（Slide Transition）
  · .slide 之间用 24px gap + 背景色过渡，不要硬切
  · 上一页离开视口时：opacity 渐变到 0.6
  · 当前页进入时：opacity 0.4→1，0.5s

▎光标跟随效果（Cursor Spotlight — 仅封面）
  · 封面背景有一个 radial-gradient 跟随鼠标位置的光斑（Terminal Orange 极淡）
  · JS：mousemove 更新 CSS 变量 --cursor-x / --cursor-y
  · CSS：background-image: radial-gradient(300px circle at var(--cursor-x,50%) var(--cursor-y,50%), rgba(247,129,102,0.06), transparent 70%)
  · 必须用 transparent 70% 终止（不能只写 transparent），否则渐变会延伸到角落，整个封面被淡色雾覆盖，parchment 底色被遮住
  · 必须用 background-image 属性（不能是 background shorthand），否则会覆盖 .slide 的 background-color，导致封面失去容器底色、透出 body 灰底
  · 离开封面区域时光斑淡出

▎悬停微交互（Hover Micro-Interaction）
  · Metric 卡：hover scale(1.03) + 数字橙色加深，0.2s
  · 代码框：hover 边框橙色微光（0 0 0 3px rgba(247,129,102,0.1)），0.25s
  · VS 两栏右栏 .mine：hover 橙边加粗 + 微光加深
  · Scene 卡：hover translateY(-4px) + 橙边显现，0.25s
  · 可点击元素：hover cursor:pointer + 背景色过渡

▎呼吸感（Ambient Breathing — 终端光标闪烁）
  · 光标 cursor-blink：@keyframes blink opacity(1→0→1) 1s steps(2) infinite，橙色方块
  · "● live/running" 状态点：@keyframes pulse opacity(0.6→1→0.6) 2s ease-in-out infinite
  · 每页最多 2 个呼吸元素，避免视觉嘈杂

约束：
  · 不引入外部 JS 库（GSAP/Motion 等），只用原生 CSS @keyframes + IntersectionObserver + requestAnimationFrame
  · 全部动效在 <style> 和 <script> 内，不外链
  · 脚本总量不超过 120 行 vanilla JS
  · @media (prefers-reduced-motion: reduce) 关闭所有动画，.reveal 直接 opacity:1 transform:none
  · 性能：只用 transform / opacity / filter / clip-path 做动画，不触发 layout
  · 每页入场总时长不超过 1.5s
  · 层叠上下文：每个 .slide 必须 isolation:isolate，防止 transform 溢出影响相邻 slide
  · 文字不换行：多行标题不要用 JS 拆字逐字入场，改用 reveal-slide-l 整体入场
  · SVG 边界安全：所有 SVG 内部元素坐标 + 尺寸必须落在 viewBox 范围内；text 元素需留 ≥4px 安全余量；SVG width 用 "100%"
  · 终端场景特有：语义色（green/blue/yellow/purple/red）仅用于代码高亮，不参与动画主色；
    打字机效果必须用 steps() 硬切，不要用 ease 柔和过渡
  · Terminal Orange 占比：动效中 #f78166 占面积不超过 10%，与静态规范一致
  · SVG marker 引用：使用 marker-end="url(#id)" 前，必须在 SVG 内 <defs> 中定义 <marker>，否则箭头不显示。标准 marker 定义：
    <defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M1 1 L7 4 L1 7 Z" fill="#999"/></marker></defs>
    fill 颜色按本模板的轴线/辅助线色设置（Kami 用 #ddd9cc，deck-report 用 #e5e7eb，cobalt-grid 用 #1F2BE0，bloomberg 用 #1F3A5F 等）
  · bar-anim 一致性：同一图表内所有柱子必须统一使用 bar-anim class + bar-dN 延迟，禁止部分柱子有动画部分没有
  · 环形图 stroke-dasharray 必须 = 2πr（周长公式），stroke-dashoffset 目标 = C × (1 - 比例)
  · 折线图 line-anim 的 stroke-dasharray 必须等于实际路径长度（不是固定数值）`;

const DECK_CLASSIC_MOTION_ANTI_PATTERNS = `✗ 引入 GSAP / Motion / 外部动画库
✗ 动效无 prefers-reduced-motion 降级
✗ 语义色（green/blue/yellow/purple/red）当装饰动效主色闪烁（仅限代码高亮）
✗ 打字机效果用 ease 柔和过渡（必须 steps() 硬切）
✗ Titlebar 打字机用 JS 字符串拼接（应用 CSS steps() clip-path）
✗ Terminal Orange 动效占面积超过 10%
✗ 引入第三方装饰色或彩色渐变铺底
`;

/** Motion deck-classic prompt = static prompt + Motion chapter + motion anti-patterns. */
const DECK_CLASSIC_MOTION_PROMPT = `${TEMPLATE_SELECTION_GUIDE}
${DECK_CLASSIC_PROMPT}
${DECK_CLASSIC_MOTION_CHAPTER}
────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
✗ 浅色 / 纸张底；✗ 语义色（红绿蓝黄紫）当装饰大面积铺底
✗ 橙色强调占比过高（沦为堆砌）；✗ 叙述正文用 mono、技术元数据用 sans（角色错配）
✗ 滥用 font-weight 700/800 当强调（应优先 .hl 橙 / 字号）
✗ 内容溢出 720px 不做内部滚动；✗ 引入第三方装饰色或彩色渐变铺底
${DECK_CLASSIC_MOTION_ANTI_PATTERNS}
────────────────────────────────────────
组织方式
────────────────────────────────────────
按内容自然组织页数与每页结构，不要凑页数或留半页空白。
每页都是 titlebar + body + footer 三段式，固定 1280×720，信息密度高、版面布满，遵循以上全部规范。`;

/* ============================================================
 * peoples-platform — 色块砸落（蓝/橙/红三色块 + grain 噪点）
 * ============================================================ */

/** Static peoples-platform prompt — extracted from inline. */
const PEOPLES_PLATFORM_PROMPT = `用 People's Platform (Block & Bold) 设计语言帮我把内容排成一份演示稿（主题与内容我会另行提供，或见下文）。
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
约 10 页：cover / toc / manifesto / pillars / stat / platform / quote / timeline / compare / close，每页固定 1280×720，信息密度高、版面布满。`;

/** Motion chapter appended to the peoples-platform static prompt. */
const PEOPLES_PLATFORM_MOTION_CHAPTER = `
────────────────────────────────────────
09 · Motion & Interaction 动效与交互（色块砸落级编排）
────────────────────────────────────────
People's Platform 的动效语言是"印刷色块的暴力戏剧"——色块从底部揭起、slab 标题砸落、
text-shadow 逐层叠加、Caveat 手写体横向滑入，像一份正在被工人张贴的街头海报。
动效要有重量感、有印刷感、有手作感。以下规范确保每一页进入视口时都有"被张贴过"的质感。

▎入场编排系统（Cinematic Reveal）
每个 .slide 进入视口时，子元素按"色块→slab 标题→副标题→正文→数据→手写批注"顺序依次入场，
每层之间错开 120ms，整体在 1.2s 内完成。默认隐藏态用 opacity:0 + 多种 transform 组合：
  · class="reveal"          → opacity:0; transform:translateY(20px) （上浮，用于正文/卡片）
  · class="reveal reveal-slide-l" → opacity:0; transform:translateX(-24px) （左滑，用于左栏色块）
  · class="reveal reveal-slide-r" → opacity:0; transform:translateX(24px) （右滑，用于右栏色块）
  · class="reveal reveal-fade"    → opacity:0 （纯淡入，用于 grain 噪点 / 装饰，避免位移干扰）
进入视口后：
  · .slide.is-visible .reveal → opacity:1; transform:none;
    transition: opacity .6s cubic-bezier(0.16,1,0.3,1), transform .6s cubic-bezier(0.16,1,0.3,1)
  · 延迟阶梯：reveal-d1(0s) / reveal-d2(.12s) / reveal-d3(.24s) / reveal-d4(.36s) / reveal-d5(.48s) / reveal-d6(.6s)
  · 触发：页尾 <script> 用 IntersectionObserver（threshold:0.18）给 .slide 加 .is-visible，一次性 unobserve

▎封面签名动效（Signature Animation — 色块揭起 + Slab 砸落 + Shadow 叠加 + Brush 滑入）
封面是 People's Platform 的第一印象，动效比内页重 3 倍：
  · 三色块 block-rise：蓝/橙/红三色块从底部揭起，
    @keyframes block-rise clip-path:inset(100% 0 0 0)→inset(0)，0.7s cubic-bezier(0.16,1,0.3,1)，
    三色块依次延迟 0.15s，揭起后定格
  · Slab 标题 slab-slam：@keyframes slab-slam 从 scale(1.3) + translateY(-30px) + opacity:0
    → scale(1) + translateY(0) + opacity:1，0.5s cubic-bezier(0.7,0,0.3,1)，硬砸落定格，
    transform-origin:bottom left；砸落幅度 ≤30px，不要弹性回弹
  · Text-shadow shadow-stack：@keyframes shadow-stack text-shadow 逐层叠加，
    从 text-shadow:none → 1px 1px 0 #2C2CDC → 2px 2px 0 #F2A03A → 3px 3px 0 #E83A2A，
    0.6s steps(3)，每层叠加上去，形成立体印章感
  · Caveat 手写批注 brush-slide：@keyframes brush-slide 从 translateX(-40px) + opacity:0
    → translateX(0) + opacity:1，0.6s cubic-bezier(0.16,1,0.3,1)，横向滑入手写体
  · 封面 hero 标题：slab-slam 砸落入场，不要用 JS 拆字逐字入场
  · 底部数据：count-up 动画
  · grain 噪点：reveal-fade 最后叠层

▎数字滚动动画（Count-Up — 用于超大数字 / stat block）
  · 带 data-num 属性的元素，进入视口时从 0 滚动到目标值，1.6s ease-out
  · JS：requestAnimationFrame 插值，支持整数和小数（1 位小数）
  · 千分位用逗号格式化，DM Mono 字体 + tabular-nums
  · 示例：<span class="metric-num" data-num="1280000">0</span>

▎SVG 图表高级绘制（色块数据图）
  · 色块条形图：每条 clip-path 从 height:0→height:100%（自下而上），0.8s，依次延迟 0.15s
  · 几何拼贴：stroke-dashoffset 全长→0，1.5s cubic-bezier(0.16,1,0.3,1)
  · 色块矩阵：单元格逐个 opacity(0→1) + scale(0.5→1)，0.3s/格，stagger 0.06s
  · 数据点圆点：在线条绘制完成后依次弹出 scale(0→1) + opacity(0→1)，0.4s，stagger 0.08s
  · 所有 SVG 动画在 slide 可见时由 JS 添加 .is-animated class 触发

▎视差效果（Parallax — grain 噪点与前景分层）
  · 背景 grain 噪点：translateY 按滚动比例的 0.15 倍移动（噪点作为底层缓慢移动）
  · 装饰色块：translateY 按滚动比例的 0.3 倍移动（前景色块更活跃）
  · JS：scroll 事件 + rAF，计算 slide 在视口中的偏移比例，设置 CSS 变量 --parallax
  · CSS：.parallax-bg { transform: translateY(var(--parallax, 0px)) }
  · 每页最多 1 个视差元素

▎页面转场（Slide Transition）
  · .slide 之间用 24px gap + 背景色过渡，不要硬切
  · 上一页离开视口时：opacity 渐变到 0.6
  · 当前页进入时：opacity 0.4→1，0.5s

▎光标跟随效果（Cursor Spotlight — 仅封面）
  · 封面背景有一个 radial-gradient 跟随鼠标位置的光斑（混合三色，极淡）
  · JS：mousemove 更新 CSS 变量 --cursor-x / --cursor-y
  · CSS：background-image: radial-gradient(300px circle at var(--cursor-x,50%) var(--cursor-y,50%), rgba(44,44,220,0.05), transparent 70%)
  · 必须用 transparent 70% 终止（不能只写 transparent），否则渐变会延伸到角落，整个封面被淡色雾覆盖，parchment 底色被遮住
  · 必须用 background-image 属性（不能是 background shorthand），否则会覆盖 .slide 的 background-color，导致封面失去容器底色、透出 body 灰底
  · 离开封面区域时光斑淡出

▎悬停微交互（Hover Micro-Interaction）
  · 色块卡：hover scale(1.03) + 色块加亮，0.25s
  · Slab 标题：hover 时 shadow-stack 重播一次（0.6s steps(3)）
  · Caveat 手写批注：hover 时 brush-slide 重播一次
  · 可点击元素：hover cursor:pointer + 背景色过渡

▎呼吸感（Ambient Breathing — grain 噪点呼吸）
  · grain 噪点 grain-breathe：@keyframes breathe opacity(0.12→0.18→0.12) 5s ease-in-out infinite
  · 关键 stat 数字：@keyframes pulse opacity(0.8→1→0.8) 3s ease-in-out infinite
  · 每页最多 2 个呼吸元素，避免视觉嘈杂

约束：
  · 不引入外部 JS 库（GSAP/Motion 等），只用原生 CSS @keyframes + IntersectionObserver + requestAnimationFrame
  · 全部动效在 <style> 和 <script> 内，不外链
  · 脚本总量不超过 120 行 vanilla JS
  · @media (prefers-reduced-motion: reduce) 关闭所有动画，.reveal 直接 opacity:1 transform:none
  · 性能：只用 transform / opacity / filter / clip-path 做动画，不触发 layout
  · 每页入场总时长不超过 1.5s
  · 层叠上下文：每个 .slide 必须 isolation:isolate，防止 transform 溢出影响相邻 slide
  · 文字不换行：多行标题不要用 JS 拆字逐字入场，改用 slab-slam 整体入场
  · SVG 边界安全：所有 SVG 内部元素坐标 + 尺寸必须落在 viewBox 范围内；text 元素需留 ≥4px 安全余量；SVG width 用 "100%"
  · 色块场景特有：三色块（蓝/橙/红）仅限大面积平涂区域，不在正文文字上使用；
    slab-slam 砸落幅度 ≤30px，避免破坏 slab 字距一致性
  · grain 噪点 opacity 上限 0.18，超过会让奶油底发灰
  · SVG marker 引用：使用 marker-end="url(#id)" 前，必须在 SVG 内 <defs> 中定义 <marker>，否则箭头不显示。标准 marker 定义：
    <defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M1 1 L7 4 L1 7 Z" fill="#999"/></marker></defs>
    fill 颜色按本模板的轴线/辅助线色设置（Kami 用 #ddd9cc，deck-report 用 #e5e7eb，cobalt-grid 用 #1F2BE0，bloomberg 用 #1F3A5F 等）
  · bar-anim 一致性：同一图表内所有柱子必须统一使用 bar-anim class + bar-dN 延迟，禁止部分柱子有动画部分没有
  · 环形图 stroke-dasharray 必须 = 2πr（周长公式），stroke-dashoffset 目标 = C × (1 - 比例)
  · 折线图 line-anim 的 stroke-dasharray 必须等于实际路径长度（不是固定数值）`;

const PEOPLES_PLATFORM_MOTION_ANTI_PATTERNS = `✗ 引入 GSAP / Motion / 外部动画库
✗ 动效无 prefers-reduced-motion 降级
✗ 三色块（蓝/橙/红）用在正文文字上（仅限大面积平涂区域）
✗ slab-slam 砸落幅度超过 30px（破坏 slab 字距一致性）
✗ slab-slam 用弹性回弹（应硬砸定格）
✗ shadow-stack 用柔和过渡（应 steps(3) 逐层叠加）
✗ grain 噪点 opacity 超过 0.18（奶油底发灰）
`;

/** Motion peoples-platform prompt = static prompt + Motion chapter + motion anti-patterns. */
const PEOPLES_PLATFORM_MOTION_PROMPT = `${TEMPLATE_SELECTION_GUIDE}
${PEOPLES_PLATFORM_PROMPT}
${PEOPLES_PLATFORM_MOTION_CHAPTER}
────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
${PEOPLES_PLATFORM_MOTION_ANTI_PATTERNS}
────────────────────────────────────────
组织方式
────────────────────────────────────────
约 10 页：cover / toc / manifesto / pillars / stat / platform / quote / timeline / compare / close，每页固定 1280×720，信息密度高、版面布满。`;

/* ============================================================
 * long-table — 锈红菜单（单一锈红 #B53D2A，仪式感）
 * ============================================================ */

/** Static long-table prompt — extracted from inline. */
const LONG_TABLE_PROMPT = `用 Long Table 设计语言帮我把内容排成一份演示稿（主题与内容我会另行提供，或见下文）。
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
约 8 页：cover / manifesto / index / featured / menu / quote / schedule / closing，每页固定 1280×720，信息密度高、版面布满。`;

/** Motion chapter appended to the long-table static prompt. */
const LONG_TABLE_MOTION_CHAPTER = `
────────────────────────────────────────
09 · Motion & Interaction 动效与交互（菜单仪式级编排）
────────────────────────────────────────
Long Table 的动效语言是"被侍者端上的菜单"——菜单行依次滑入、徽章旋入、标签弹出，
像一份被仪式化呈现的餐厅菜单。动效要有仪式感、有节奏感，但不花哨。
以下规范确保每一页进入视口时都有"被侍者奉上"的质感。

▎入场编排系统（Cinematic Reveal）
每个 .slide 进入视口时，子元素按"标题→副标题→正文→菜单行→徽章→标签"顺序依次入场，
每层之间错开 120ms，整体在 1.2s 内完成。默认隐藏态用 opacity:0 + 多种 transform 组合：
  · class="reveal"          → opacity:0; transform:translateY(20px) （上浮，用于正文/卡片）
  · class="reveal reveal-slide-l" → opacity:0; transform:translateX(-24px) （左滑，用于左侧叙述）
  · class="reveal reveal-slide-r" → opacity:0; transform:translateX(24px) （右滑，用于右侧菜单）
  · class="reveal reveal-fade"    → opacity:0 （纯淡入，用于标签 / 装饰，避免位移干扰）
进入视口后：
  · .slide.is-visible .reveal → opacity:1; transform:none;
    transition: opacity .7s cubic-bezier(0.16,1,0.3,1), transform .7s cubic-bezier(0.16,1,0.3,1)
  · 延迟阶梯：reveal-d1(0s) / reveal-d2(.12s) / reveal-d3(.24s) / reveal-d4(.36s) / reveal-d5(.48s) / reveal-d6(.6s)
  · 触发：页尾 <script> 用 IntersectionObserver（threshold:0.18）给 .slide 加 .is-visible，一次性 unobserve

▎封面签名动效（Signature Animation — 菜单行滑入 + 徽章旋入 + 标签弹出）
封面是 Long Table 的第一印象，动效比内页重 3 倍：
  · 菜单行 menu-row-slide：每行从 translateX(-30px) + opacity:0 → translateX(0) + opacity:1，
    0.6s cubic-bezier(0.16,1,0.3,1)，stagger 0.06s，依次滑入，仪式感但不花哨
  · 圆形徽章 badge-rotate：@keyframes badge-rotate 从 scale(0.5) + rotate(-90deg) + opacity:0
    → scale(1) + rotate(0) + opacity:1，0.6s cubic-bezier(0.34,1.56,0.64,1)，略带弹性旋入
  · rect-tag tag-pop：@keyframes tag-pop 从 scale(0) + opacity:0 → scale(1.1) → scale(1)，
    0.4s cubic-bezier(0.34,1.56,0.64,1)，弹出定格
  · 封面 hero 标题：reveal-slide-l 整体入场（不要拆字逐字）
  · 封面副标题：标题完成后 0.3s，reveal-fade 入场
  · 底部 seats-pill / 装饰：最后 reveal-fade
  · 全篇动效有仪式感，但禁止弹性回弹过强（徽章除外）、禁止彩色脉冲

▎数字滚动动画（Count-Up — 用于 stat 数字 / 版次 / 座位数）
  · 带 data-num 属性的元素，进入视口时从 0 滚动到目标值，1.6s ease-out
  · JS：requestAnimationFrame 插值，支持整数和小数（1 位小数）
  · 千分位用逗号格式化，Bricolage Grotesque 字体 + tabular-nums
  · 示例：<span class="metric-num" data-num="1280000">0</span>

▎SVG 图表高级绘制（菜单 / 时间线 / 表格）
  · 菜单表格行：每行 transform:translateX(-30px) + opacity:0 → translateX(0) + opacity:1，0.5s，stagger 0.06s
  · 圆形徽章 / 装饰圆：stroke-dashoffset 全长→0，1.5s cubic-bezier(0.16,1,0.3,1)，绘制后保持
  · 时间线节点：scale(0→1) + opacity(0→1)，0.4s，stagger 0.08s
  · 数据条：clip-path 从 width:0→width:100%，0.8s，依次延迟 0.1s
  · 所有 SVG 动画在 slide 可见时由 JS 添加 .is-animated class 触发

▎视差效果（Parallax — 背景纹理与前景分层）
  · 背景装饰色块 / 锈红圆点：translateY 按滚动比例的 0.2 倍移动
  · 前景菜单 / 表格：正常滚动
  · JS：scroll 事件 + rAF，计算 slide 在视口中的偏移比例，设置 CSS 变量 --parallax
  · CSS：.parallax-bg { transform: translateY(var(--parallax, 0px)) }
  · 每页最多 1 个视差元素

▎页面转场（Slide Transition）
  · .slide 之间用 24px gap + 背景色过渡，不要硬切
  · 上一页离开视口时：opacity 渐变到 0.6
  · 当前页进入时：opacity 0.4→1，0.5s

▎光标跟随效果（Cursor Spotlight — 仅封面）
  · 封面背景有一个 radial-gradient 跟随鼠标位置的光斑（锈红，极淡）
  · JS：mousemove 更新 CSS 变量 --cursor-x / --cursor-y
  · CSS：background-image: radial-gradient(300px circle at var(--cursor-x,50%) var(--cursor-y,50%), rgba(181,61,42,0.05), transparent 70%)
  · 必须用 transparent 70% 终止（不能只写 transparent），否则渐变会延伸到角落，整个封面被淡色雾覆盖，parchment 底色被遮住
  · 必须用 background-image 属性（不能是 background shorthand），否则会覆盖 .slide 的 background-color，导致封面失去容器底色、透出 body 灰底
  · 离开封面区域时光斑淡出

▎悬停微交互（Hover Micro-Interaction）
  · 菜单行：hover 时背景微变 + 锈红圆点高亮，0.25s
  · 圆形徽章：hover 时 badge-rotate 重播一次
  · rect-tag：hover 时 tag-pop 重播一次
  · 描边胶囊按钮：hover 时背景填充锈红 + 文字变白，0.2s
  · 可点击元素：hover cursor:pointer + 背景色过渡

▎呼吸感（Ambient Breathing — 仪式克制）
  · 关键版次徽章：@keyframes pulse opacity(0.7→1→0.7) 3.5s ease-in-out infinite（极克制）
  · seats-pill：@keyframes subtle-glow box-shadow 微微呼吸，4s ease-in-out infinite
  · 每页最多 2 个呼吸元素，避免视觉嘈杂

约束：
  · 不引入外部 JS 库（GSAP/Motion 等），只用原生 CSS @keyframes + IntersectionObserver + requestAnimationFrame
  · 全部动效在 <style> 和 <script> 内，不外链
  · 脚本总量不超过 120 行 vanilla JS
  · @media (prefers-reduced-motion: reduce) 关闭所有动画，.reveal 直接 opacity:1 transform:none
  · 性能：只用 transform / opacity / filter / clip-path 做动画，不触发 layout
  · 每页入场总时长不超过 1.5s
  · 层叠上下文：每个 .slide 必须 isolation:isolate，防止 transform 溢出影响相邻 slide
  · 文字不换行：多行标题不要用 JS 拆字逐字入场，改用 reveal-slide-l 整体入场
  · SVG 边界安全：所有 SVG 内部元素坐标 + 尺寸必须落在 viewBox 范围内；text 元素需留 ≥4px 安全余量；SVG width 用 "100%"
  · 菜单场景特有：锈红 #B53D2A 占比 ≤8%，与静态规范一致；
    菜单行滑入有仪式感但不花哨（stagger 0.06s，translateX ≤30px）
  · 单一锈红：禁止引入第二种彩色动效；徽章弹性仅限圆形，矩形元素用 cubic-bezier(0.16,1,0.3,1)
  · SVG marker 引用：使用 marker-end="url(#id)" 前，必须在 SVG 内 <defs> 中定义 <marker>，否则箭头不显示。标准 marker 定义：
    <defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M1 1 L7 4 L1 7 Z" fill="#999"/></marker></defs>
    fill 颜色按本模板的轴线/辅助线色设置（Kami 用 #ddd9cc，deck-report 用 #e5e7eb，cobalt-grid 用 #1F2BE0，bloomberg 用 #1F3A5F 等）
  · bar-anim 一致性：同一图表内所有柱子必须统一使用 bar-anim class + bar-dN 延迟，禁止部分柱子有动画部分没有
  · 环形图 stroke-dasharray 必须 = 2πr（周长公式），stroke-dashoffset 目标 = C × (1 - 比例)
  · 折线图 line-anim 的 stroke-dasharray 必须等于实际路径长度（不是固定数值）`;

const LONG_TABLE_MOTION_ANTI_PATTERNS = `✗ 引入 GSAP / Motion / 外部动画库
✗ 动效无 prefers-reduced-motion 降级
✗ 锈红 #B53D2A 占面积超过 8%（与静态规范一致）
✗ 引入第二种彩色动效（Long Table 单一锈红）
✗ 菜单行滑入 stagger 过大（超过 0.06s，失去仪式感节奏）
✗ 菜单行滑入 translateX 超过 30px（位移过夸张，不克制）
✗ 矩形元素用弹性曲线（仅圆形徽章允许 cubic-bezier(0.34,1.56,0.64,1)）
`;

/** Motion long-table prompt = static prompt + Motion chapter + motion anti-patterns. */
const LONG_TABLE_MOTION_PROMPT = `${TEMPLATE_SELECTION_GUIDE}
${LONG_TABLE_PROMPT}
${LONG_TABLE_MOTION_CHAPTER}
────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
${LONG_TABLE_MOTION_ANTI_PATTERNS}
────────────────────────────────────────
组织方式
────────────────────────────────────────
约 8 页：cover / manifesto / index / featured / menu / quote / schedule / closing，每页固定 1280×720，信息密度高、版面布满。`;

/* ============================================================
 * swiss-grid — 瑞士国际主义（swiss-red #C8102E + 12 列网格，硬切）
 * ============================================================ */

/** Static swiss-grid prompt — extracted from inline. */
const SWISS_GRID_PROMPT = `用「瑞士国际主义平面设计风（Swiss Typographic Style）」设计语言帮我把内容排成一份演示稿（主题与内容我会另行提供，或见下文）。
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
约 10 页：cover / quote / principle / grid / figure / type / layout / negative-space / output / colophon，每页固定 1280×720，严格 12 列网格、不对称平衡、红黑双色、大留白，遵循以上全部规范。`;

/** Motion chapter appended to the swiss-grid static prompt. */
const SWISS_GRID_MOTION_CHAPTER = `
────────────────────────────────────────
09 · Motion & Interaction 动效与交互（瑞士网格级编排）
────────────────────────────────────────
Swiss Grid 的动效语言是"网格被精确填充的过程"——标题网格揭示、几何块硬切缩放、
负空间渐显，像一份正在被排版师对齐的瑞士海报。动效要精确、要克制、要几何感。
禁止任何打破网格的位移动效。以下规范确保每一页进入视口时都有"被网格化过"的质感。

▎入场编排系统（Cinematic Reveal — 网格化揭示）
每个 .slide 进入视口时，子元素按"label→display 标题→body lead→几何块→图表→负空间"顺序依次入场，
每层之间错开 100ms，整体在 1.2s 内完成。默认隐藏态用 opacity:0 + 多种 transform 组合：
  · class="reveal"          → opacity:0 （纯淡入，用于正文，避免位移打破网格）
  · class="reveal reveal-grid" → opacity:0; clip-path:inset(0 0 100% 0) （网格揭示，从下到上，用于 display 标题）
  · class="reveal reveal-scale" → opacity:0; transform:scale(0) （硬切缩放，用于几何块 / 图表）
  · class="reveal reveal-fade"  → opacity:0 （纯淡入，用于负空间 / 装饰）
进入视口后：
  · .slide.is-visible .reveal → opacity:1; transform:none; clip-path:inset(0);
    transition: opacity .6s linear, transform .6s cubic-bezier(0.5,0,0.5,1), clip-path .6s cubic-bezier(0.5,0,0.5,1)
  · 延迟阶梯：reveal-d1(0s) / reveal-d2(.1s) / reveal-d3(.2s) / reveal-d4(.3s) / reveal-d5(.4s) / reveal-d6(.5s)
  · 触发：页尾 <script> 用 IntersectionObserver（threshold:0.2）给 .slide 加 .is-visible，一次性 unobserve
  · 禁止使用 cubic-bezier(0.16,1,0.3,1) 柔软缓动；统一用 linear 或 cubic-bezier(0.5,0,0.5,1)

▎封面签名动效（Signature Animation — 网格揭示 + 几何硬切 + 负空间渐显）
封面是瑞士网格的第一印象，动效比内页重 3 倍：
  · Display 标题 grid-reveal：@keyframes grid-reveal clip-path 从 inset(0 0 100% 0)
    → inset(0 0 0 0)，0.8s cubic-bezier(0.5,0,0.5,1)，从下到上网格揭示，像被排版师对齐
  · 几何块 block-scale：@keyframes block-scale 从 scale(0) + opacity:0
    → scale(1) + opacity:1，0.5s cubic-bezier(0.5,0,0.5,1)，硬切缩放，无回弹
  · 负空间 negative-fade：@keyframes negative-fade opacity(0→1)，1s linear，渐显留白
  · Display number：count-up 动画（见下文）
  · swiss-red 焦点元素：最后 reveal-scale 硬切入场
  · 封面 hero 标题：grid-reveal 整体入场，不要用 JS 拆字逐字入场
  · 全篇禁止使用柔软缓动；禁止打破网格的位移动效（如 translateX/Y 大幅度位移）

▎数字滚动动画（Count-Up — 用于 Display number / stat block）
  · 带 data-num 属性的元素，进入视口时从 0 滚动到目标值，1.4s linear（不用 ease-out，保持精确感）
  · JS：requestAnimationFrame 插值，支持整数和小数（1 位小数）
  · 千分位用逗号格式化，Inter 字体 weight 900 + tabular-nums
  · 示例：<span class="metric-num" data-num="1280000">0</span>

▎SVG 图表高级绘制（极简几何）
  · 柱状图：每根柱子 transform:scaleY(0)→scaleY(1)，transform-origin:bottom，0.6s cubic-bezier(0.5,0,0.5,1)，
    依次延迟 0.1s，硬切无回弹
  · 几何拼贴：clip-path 从 inset(0 0 100% 0)→inset(0)，0.6s，stagger 0.1s，网格揭示
  · 网格图 / 12 列虚线：stroke-dashoffset 全长→0，1.2s linear，绘制后保持
  · 焦点 swiss-red 块：最后 block-scale 硬切入场
  · 所有 SVG 动画在 slide 可见时由 JS 添加 .is-animated class 触发

▎视差效果（Parallax — 严格网格内的纵向位移）
  · 背景几何块 / 网格指示线：translateY 按滚动比例的 0.15 倍移动（仅在网格列内位移，不打破网格）
  · 前景内容：正常滚动
  · JS：scroll 事件 + rAF，计算 slide 在视口中的偏移比例，设置 CSS 变量 --parallax
  · CSS：.parallax-bg { transform: translateY(var(--parallax, 0px)) }
  · 每页最多 1 个视差元素；禁止横向位移 parallax（会打破网格）

▎页面转场（Slide Transition）
  · .slide 之间用 24px gap + 背景色过渡，不要硬切
  · 上一页离开视口时：opacity 渐变到 0.7（保持上下文感）
  · 当前页进入时：opacity 0.5→1，0.4s linear

▎光标跟随效果（Cursor Spotlight — 仅封面）
  · 封面背景有一个 radial-gradient 跟随鼠标位置的光斑（swiss-red 极淡）
  · JS：mousemove 更新 CSS 变量 --cursor-x / --cursor-y
  · CSS：background-image: radial-gradient(300px circle at var(--cursor-x,50%) var(--cursor-y,50%), rgba(200,16,46,0.04), transparent 70%)
  · 必须用 transparent 70% 终止（不能只写 transparent），否则渐变会延伸到角落，整个封面被淡色雾覆盖，parchment 底色被遮住
  · 必须用 background-image 属性（不能是 background shorthand），否则会覆盖 .slide 的 background-color，导致封面失去容器底色、透出 body 灰底
  · 离开封面区域时光斑淡出

▎悬停微交互（Hover Micro-Interaction — 网格内硬切）
  · 几何块：hover 时 scale(1.05) + swiss-red 加深，0.2s cubic-bezier(0.5,0,0.5,1)
  · Stat block：hover 时数字 swiss-red 加深 + 描边显现，0.2s
  · 网格格子：hover 时背景 swiss-red tint + 边框加粗，0.15s 硬切
  · 可点击元素：hover cursor:pointer + 背景色硬切过渡

▎呼吸感（Ambient Breathing — 极克制）
  · 关键 swiss-red 焦点元素：@keyframes pulse opacity(0.8→1→0.8) 4s ease-in-out infinite（极克制）
  · 网格指示线：@keyframes subtle-glow opacity(0.3→0.5→0.3) 5s ease-in-out infinite
  · 每页最多 1 个呼吸元素（瑞士网格要克制），避免视觉嘈杂

约束：
  · 不引入外部 JS 库（GSAP/Motion 等），只用原生 CSS @keyframes + IntersectionObserver + requestAnimationFrame
  · 全部动效在 <style> 和 <script> 内，不外链
  · 脚本总量不超过 120 行 vanilla JS
  · @media (prefers-reduced-motion: reduce) 关闭所有动画，.reveal 直接 opacity:1 transform:none clip-path:none
  · 性能：只用 transform / opacity / filter / clip-path 做动画，不触发 layout
  · 每页入场总时长不超过 1.5s
  · 层叠上下文：每个 .slide 必须 isolation:isolate，防止 transform 溢出影响相邻 slide
  · 文字不换行：多行标题不要用 JS 拆字逐字入场，改用 grid-reveal 整体入场
  · SVG 边界安全：所有 SVG 内部元素坐标 + 尺寸必须落在 viewBox 范围内；text 元素需留 ≥4px 安全余量；SVG width 用 "100%"
  · 瑞士网格场景特有：
    · 禁止 cubic-bezier(0.16,1,0.3,1) 柔软缓动，统一用 linear 或 cubic-bezier(0.5,0,0.5,1)
    · 禁止打破网格的位移动效（如 translateX/Y 大幅度位移、旋转、模糊）；动效只能在网格列内进行
    · 几何块硬切缩放：scale(0)→scale(1) 无回弹，不要弹性曲线
  · swiss-red 占比：动效中 swiss-red #C8102E 占面积不超过 8%，与静态规范一致
  · SVG marker 引用：使用 marker-end="url(#id)" 前，必须在 SVG 内 <defs> 中定义 <marker>，否则箭头不显示。标准 marker 定义：
    <defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M1 1 L7 4 L1 7 Z" fill="#999"/></marker></defs>
    fill 颜色按本模板的轴线/辅助线色设置（Kami 用 #ddd9cc，deck-report 用 #e5e7eb，cobalt-grid 用 #1F2BE0，bloomberg 用 #1F3A5F 等）
  · bar-anim 一致性：同一图表内所有柱子必须统一使用 bar-anim class + bar-dN 延迟，禁止部分柱子有动画部分没有
  · 环形图 stroke-dasharray 必须 = 2πr（周长公式），stroke-dashoffset 目标 = C × (1 - 比例)
  · 折线图 line-anim 的 stroke-dasharray 必须等于实际路径长度（不是固定数值）`;

const SWISS_GRID_MOTION_ANTI_PATTERNS = `✗ 引入 GSAP / Motion / 外部动画库
✗ 动效无 prefers-reduced-motion 降级
✗ 持续动画超过 1 个/页（瑞士网格要克制）
✗ 用 cubic-bezier(0.16,1,0.3,1) 柔软缓动（瑞士网格禁用，应用 linear 或 cubic-bezier(0.5,0,0.5,1)）
✗ 打破网格的位移动效（translateX/Y 大幅度位移、旋转、模糊）
✗ 几何块缩放用弹性回弹（应 scale(0)→scale(1) 硬切）
✗ 横向视差位移（会打破网格，仅允许纵向 translateY）
✗ swiss-red 动效占面积超过 8%
✗ 引入 swiss-red / ink 以外的彩色
`;

/** Motion swiss-grid prompt = static prompt + Motion chapter + motion anti-patterns. */
const SWISS_GRID_MOTION_PROMPT = `${TEMPLATE_SELECTION_GUIDE}
${SWISS_GRID_PROMPT}
${SWISS_GRID_MOTION_CHAPTER}
────────────────────────────────────────
Anti-Patterns 反面示例（必须规避）
────────────────────────────────────────
✗ 居中布局或对称构图；✗ 填满整个画布不留负空间
✗ 引入 swiss-red 以外的彩色；✗ 渐变 / 阴影 / 照片
✗ 混排多种字族（应全篇 Inter）；✗ 合成 bold 当唯一强调
✗ 圆角超过 2px；✗ 装饰性元素（应为功能几何）
${SWISS_GRID_MOTION_ANTI_PATTERNS}
────────────────────────────────────────
组织方式
────────────────────────────────────────
约 10 页：cover / quote / principle / grid / figure / type / layout / negative-space / output / colophon，每页固定 1280×720，严格 12 列网格、不对称平衡、红黑双色、大留白，遵循以上全部规范。`;

export const TEMPLATES: TemplateItem[] = [
  {
    id: 'nextppt-kami',
    kind: 'deck',
    tags: ['Kami', 'NextPPT'],
    sampleUrl: '/kami-nextppt-deck.html',
    motionSampleUrl: '/kami-nextppt-deck-motion.html',
    credit: KAMI_CREDIT,
    prompt: KAMI_STATIC_PROMPT,
    motionPrompt: KAMI_MOTION_PROMPT,
  },
  {
    id: 'resume',
    kind: 'doc',
    tags: ['Kami', 'resume', 'A4'],
    sampleUrl: '/kami-resume-musk.html',
    motionSampleUrl: '/kami-resume-musk-motion.html',
    credit: KAMI_CREDIT,
    prompt: RESUME_PROMPT,
    motionPrompt: RESUME_MOTION_PROMPT,
  },
  {
    id: 'deck-classic',
    kind: 'deck',
    tags: ['Terminal', 'Dev', '16:9'],
    sampleUrl: '/dev-share-deck.html',
    motionSampleUrl: '/dev-share-deck-motion.html',
    easterEgg: true,
    prompt: DECK_CLASSIC_PROMPT,
    motionPrompt: DECK_CLASSIC_MOTION_PROMPT,
  },
  {
    id: 'deck-report',
    kind: 'deck',
    tags: ['Business', 'PMO', '16:9'],
    sampleUrl: '/biz-report-deck.html',
    prompt: DECK_REPORT_PROMPT,
    motionPrompt: DECK_REPORT_MOTION_PROMPT,
    motionSampleUrl: '/biz-report-deck-motion.html',
  },
  {
    id: 'sakura-chroma',
    kind: 'deck',
    tags: ['Sakura', 'Chroma', '16:9'],
    sampleUrl: '/template-sakura-chroma.html',
    credit: FRONTEND_SLIDES_CREDIT,
    prompt: SAKURA_CHROMA_PROMPT,
    motionPrompt: SAKURA_CHROMA_MOTION_PROMPT,
    motionSampleUrl: '/template-sakura-chroma-motion.html',
  },
  {
    id: 'cobalt-grid',
    kind: 'deck',
    tags: ['Cobalt', 'Grid', '16:9'],
    sampleUrl: '/template-cobalt-grid.html',
    credit: FRONTEND_SLIDES_CREDIT,
    prompt: COBALT_GRID_PROMPT,
    motionPrompt: COBALT_GRID_MOTION_PROMPT,
    motionSampleUrl: '/template-cobalt-grid-motion.html',
  },
  {
    id: 'peoples-platform',
    kind: 'deck',
    tags: ['Block', 'Bold', '16:9'],
    sampleUrl: '/template-peoples-platform.html',
    motionSampleUrl: '/template-peoples-platform-motion.html',
    credit: FRONTEND_SLIDES_CREDIT,
    prompt: PEOPLES_PLATFORM_PROMPT,
    motionPrompt: PEOPLES_PLATFORM_MOTION_PROMPT,
  },
  {
    id: 'long-table',
    kind: 'deck',
    tags: ['Long', 'Table', '16:9'],
    sampleUrl: '/template-long-table.html',
    motionSampleUrl: '/template-long-table-motion.html',
    credit: FRONTEND_SLIDES_CREDIT,
    prompt: LONG_TABLE_PROMPT,
    motionPrompt: LONG_TABLE_MOTION_PROMPT,
  },
  {
    id: 'brutalist-newspaper',
    kind: 'deck',
    tags: ['Brutalist', 'Newspaper', '16:9'],
    sampleUrl: '/template-brutalist-newspaper.html',
    credit: PPT_MASTER_CREDIT,
    prompt: BRUTALIST_NEWSPAPER_PROMPT,
    motionPrompt: BRUTALIST_NEWSPAPER_MOTION_PROMPT,
    motionSampleUrl: '/template-brutalist-newspaper-motion.html',
  },
  {
    id: 'bloomberg-editorial',
    kind: 'deck',
    tags: ['Bloomberg', 'Data', '16:9'],
    sampleUrl: '/template-bloomberg-editorial.html',
    credit: PPT_MASTER_CREDIT,
    prompt: BLOOMBERG_EDITORIAL_PROMPT,
    motionPrompt: BLOOMBERG_MOTION_PROMPT,
    motionSampleUrl: '/template-bloomberg-editorial-motion.html',
  },
  {
    id: 'swiss-grid',
    kind: 'deck',
    tags: ['Swiss', 'Grid', '16:9'],
    sampleUrl: '/template-swiss-grid.html',
    motionSampleUrl: '/template-swiss-grid-motion.html',
    credit: PPT_MASTER_CREDIT,
    prompt: SWISS_GRID_PROMPT,
    motionPrompt: SWISS_GRID_MOTION_PROMPT,
  },
];

export function findTemplate(id: string): TemplateItem | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
