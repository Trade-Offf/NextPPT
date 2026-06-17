export default {
  nav: {
    homeAria: 'NextPPT 首页',
    guide: '使用指南',
    templates: '模版市场',
    explore: '探索',
    openFile: '打开文件',
  },
  hero: {
    titleA: 'AI 写的 HTML，',
    titleB: '秒变',
    titleAccent: '可点编辑',
    titleC: '的演示稿',
    subtitle:
      '把 AI 生成的演示稿拖进来，点一下就能改字、换图、挪位置，再一键导出能投影的 PPT / PDF。',
    ctaOpen: '打开文件 / 拖到此处',
    loading: '加载中…',
    ctaGuide: '看 30 秒使用指南',
    unsupported: '请用 Chrome / Edge 等 Chromium 浏览器打开',
    support: '支持文件夹（可读写配套图片）或单个自包含 HTML · 需 Chromium 内核浏览器',
  },
  value: {
    eyebrow: '为什么需要 NextPPT',
    titleA: 'AI 能生成，却',
    titleAccent: '改不动',
    subtitle: '那最后一步，交给我们。',
    pains: [
      '没精力从头做 PPT，于是把文档丢给 AI，让它直接生成一份演示。',
      '但 AI 产出的 PPT 往往简陋——越来越多人改用 HTML 网页来承接，更精致、更有设计感。',
      '可一旦想改个字体、调个配色、换句文案，又得回到对话里重新描述，token 哗哗地烧，还要来回等待。',
    ],
    solution:
      '<brand>NextPPT</brand> 让你把这份 HTML 直接拖进来，在页面上点选就能改字体、配色和内容——所见即所得，<em>不再为改一个字重开一轮 AI 对话</em>。',
  },
  hub: {
    unsupportedTitle: '当前浏览器不支持本地文件读写',
    unsupportedBody:
      '本功能依赖 File System Access API，目前仅 Chromium 内核浏览器支持。请使用 <a>Chrome</a> 或 Edge / Brave / Arc 打开本页面。',
    dropTitle: '点击选择，或拖拽文件夹 / HTML 到此处',
    dropHint: 'PPT 演示稿或简历 / 长文都行——自动识别格式；文件夹模式可读写配套图片',
    choosePrompt: '要打开哪种？',
    chooseCancel: '取消',
    openFolder: '打开文件夹',
    openSingle: '打开单个 HTML',
    recall: '重新打开上次的文件夹',
    errorRecover:
      '这份文件可能格式不对、打不开。最省事的办法，是用我们的提示词 <btn>让 AI 重做一份</btn>。',
  },
  preview: {
    eyebrow: 'Q3 Roadmap',
    heading: '把草稿，做成能上台的演示',
    inspectorText: '文本',
    inspectorLayout: '排版',
  },
  parallel: {
    pass: 'PARALLEL BACKSTAGE PASS',
    tag: '平行世界',
    eyebrow: 'PARALLEL UNIVERSE · 仅供娱乐',
    titleA: '在另一个平行世界，',
    titleAccent: '他们都用 NextPPT',
    subtitle: '六位你熟悉的面孔，给出他们在「平行宇宙」里的使用感受。',
    disclaimer:
      '免责声明：本模块纯属虚构创作。人物形象由 AI 生成，言论均为 AI 想象，不代表任何真实人物的观点或立场，仅供娱乐。',
    people: [
      {
        name: '罗永浩',
        role: '理想主义者 · 发布会美学布道者',
        quote:
          '发布会 PPT 是门手艺。以前为改一页排版能熬到天亮，现在点一下就改字换图——这工具，我先用为敬，交个朋友。',
        scene: '直播间灯一开，他把发布会 keynote 拖进 NextPPT，一边讲段子一边把字号调到最后一排也能看清。',
        tags: ['手艺级排版', '点一下就改', '一键导出'],
      },
      {
        name: '胡彦斌',
        role: '音乐制作人 · 平行宇宙首席体验官',
        quote:
          '做 PPT 和写歌一样，副歌要反复打磨。以前改一版得重开一轮 AI，现在点一下就改字、换色，灵感不断电。',
        scene: '凌晨的录音棚，他把巡演策划案拖进 NextPPT，边哼旋律边把标题敲定。',
        tags: ['点选即改', '灵感不断', '一键导出'],
      },
      {
        name: '史蒂夫·乔布斯',
        role: '产品哲学家',
        quote:
          '真正的简单，是把最后一毫米的打磨权交还给人。NextPPT 删掉了所有多余步骤，只留下「点一下」。',
        scene: '车库白板前，他盯着投影只说了一句：把那个字再大一号——然后顺手点了一下。',
        tags: ['极简交互', '像素级掌控', '所见即所得'],
      },
      {
        name: '埃隆·马斯克',
        role: '第一性原理狂人',
        quote:
          'PPT 不该是瓶颈。把「生成」和「编辑」解耦，迭代速度提升一个数量级——这才是第一性原理。',
        scene: '深夜的工厂，他在两次发射窗口之间把任务简报拖进 NextPPT，五分钟改完上台。',
        tags: ['极速迭代', '解耦生成', '直接上台'],
      },
      {
        name: '黄仁勋',
        role: '算力布道者',
        quote:
          'The more you edit, the more you save——省下的每一次 AI 重算，都是省下的算力。',
        scene: '穿着皮衣站在 GTC 后台，他把主题演讲拖进 NextPPT，临场把配色换成新一代配方。',
        tags: ['省算力', '实时编辑', '一键导出'],
      },
      {
        name: '张小龙',
        role: '克制美学践行者',
        quote:
          '好的工具应该「用完即走」。把 HTML 拖进来，改完导出，不打扰——这是我的偏爱。',
        scene: '安静的工位，他没有打开任何对话框，只是点了几下，把演示稿调到刚刚好。',
        tags: ['用完即走', '克制干净', '所见即所得'],
      },
    ],
  },
  footer: {
    tagline: '下一代 PPT，从 HTML 开始。本地优先，数据不离开你的机器。',
    colProduct: '产品',
    preview: '效果预览',
    start: '开始使用',
    colResources: '资源',
    guide: '使用指南',
    templates: '模版市场',
    sample: '示例模板',
    colAbout: '关于',
    localFirst: '本地优先',
    noLogin: '无需登录',
    github: 'GitHub',
    juejin: '掘金',
    email: '邮箱',
    copy: '© {{year}} NextPPT',
  },
};
