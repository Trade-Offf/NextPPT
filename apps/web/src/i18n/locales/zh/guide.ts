export default {
  header: {
    back: '返回',
    backHome: '回到 NextPPT',
    title: '使用指南',
    backToEdit: '返回编辑',
  },
  flow: {
    eyebrow: '三步就搞定',
    steps: [
      { title: '让 AI 生成 HTML', desc: '把一段提示词发给任意 AI，拿到一份带动画和交互的 HTML 演示稿' },
      { title: '选个编辑器改', desc: 'HTML 演示台保留动画点改字，PPT 编辑器拆页精修，按需选' },
      { title: '导出上台', desc: 'HTML 演示台导出 HTML，PPT 编辑器导出 PPTX / PDF，全程本地' },
    ],
  },
  generate: {
    title: '第 1 步 · 让 AI 帮你生成 HTML',
    intro: '不会做也没关系。把下面这段「提示词」复制给任意 AI，它会回你一份现成的 HTML 演示稿文件，拿回来就能改。已经有 AI 做好的 HTML？直接打开就行，div.slide、顶层 <section>、.page 等常见分页写法都能自动识别整理；没分页也能当整页编辑。',
    promptWhat: '提示词，就是一段告诉 AI「帮我做什么」的话。',
    steps: [
      { title: '复制这段提示词', desc: '点下面的「复制提示词」，整段就复制好了，一个字都不用自己写。' },
      { title: '发给 AI，填上主题', desc: '粘贴给 ChatGPT、豆包、Kimi、Claude、Gemini 等任意 AI，把 {{topic}} 换成你的主题。' },
      { title: '把文件存下来', desc: 'AI 会回一段代码，按它的提示保存成一个文件（名字随便起，比如 我的演示.html）。' },
      { title: '回来打开它', desc: '回到首页，点击上传选「HTML 演示台」或「PPT 编辑器」，或直接把文件拖到对应区域。' },
    ],
    promptLabel: '要复制的提示词',
    copy: '复制提示词',
    copied: '已复制',
    expand: '看看里面写了啥',
    collapse: '收起',
    promptHint: '不用读，直接「复制提示词」粘给 AI 就行。好奇的话再「看看里面写了啥」。',
    actionLabel: 'AI 已经把文件给你了？',
    openGenerated: '打开这个文件',
  },
  edit: {
    title: '第 2 步 · 选个编辑器改',
    intro: '打开文件时选一种编辑器。两种编辑器各有所长，按你的需求选——想保留动画选 HTML 演示台，想拆页精修选 PPT 编辑器。',
    htmlDeck: {
      name: 'HTML 演示台',
      pill: 'main',
      desc: '保留动画与交互，原页直接改字挪位，导出还是 HTML',
      abilities: [
        { title: '动画 / 交互完整保留', desc: 'JS、过渡、滚动效果照常运行，你看到的就是最终效果' },
        { title: '点一下改文字，拖一下挪位置', desc: '进入编辑模式后，任意文字可改，任意元素可移动 / 缩放' },
        { title: '导出还是干净的 HTML', desc: '修改以 inline style 烘焙进文件，原脚本和结构不变' },
      ],
      cta: '进入 HTML 演示台',
    },
    pptEditor: {
      name: 'PPT 编辑器',
      desc: '拆页精修，像改 PPT 一样改，可导出 PPTX / PDF',
      abilities: [
        { title: '点文字就能改', desc: '点中一段文字，在右边面板里改内容、字号、颜色、对齐。' },
        { title: '双击直接在页面上敲', desc: '想更快？双击那段文字，直接在原位输入新内容。' },
        { title: '换张图片', desc: '选中图片，把一张新图拖进来，就替换好了。' },
        { title: '自由挪位置（拖动模式）', desc: '顶部切到「拖动」，任意元素都能拖着移动、拉角缩放、按 Delete 删除；切回「编辑」就只改字，不怕误碰。' },
        { title: '改错了能反悔', desc: '⌘Z 撤销、⇧⌘Z 重做；左上角还有「历史版本」，随时找回之前的样子。' },
        { title: '自动保存', desc: '改动会自动存回你打开的那个文件，不用专门点保存，也不怕丢。' },
      ],
      cta: '打开文件开始改',
    },
  },
  export: {
    title: '第 3 步 · 导出上台',
    intro: '改满意了，按你用的编辑器导出。两种导出方式，对应两种编辑器。',
    htmlExport: {
      name: 'HTML 演示台 → HTML',
      notes: [
        '修改以 inline style 烘焙进文件，原脚本和结构不变，动画照常跑、交互照常灵。',
        '一个链接就能分享，不用安装、不用转换，浏览器打开就能演示。',
        '全程在你电脑上完成，不上传服务器。',
      ],
    },
    pptExport: {
      name: 'PPT 编辑器 → PPTX / PDF',
      notes: [
        '导出的是一张张高清图（相当于给每一页拍了张照片）。所以在 PowerPoint 里不能再改字，想改字，回这里改完再导一次就好。',
        '可以只导其中几页：全部，或自己填页码（比如 1,3-5,8）。',
        '清晰度可选：标准就够投影用了；更高更清晰，但导出更慢、文件更大。',
        '页面复杂时导出会慢一点点，那是在等图片和图表画好，属于正常现象。',
        '编辑和保存都在你自己的电脑上完成；只有点「导出」时，这份文件才会上传到渲染服务器生成图片，生成后随即删除。',
      ],
    },
    actionHasDeck: '演示稿已经打开了。',
    backToExport: '回去导出',
    actionNoDeck: '先打开一份演示稿，才能导出。',
    openFile: '打开文件',
  },
  footer: {
    backHome: '← 回到 NextPPT',
    local: '本地优先 · 文件只在你电脑里',
  },
};
