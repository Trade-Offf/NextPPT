import type zh from '../zh/landing.js';

const landing: typeof zh = {
  nav: {
    homeAria: 'NextPPT home',
    guide: 'Guide',
    openFile: 'Open file',
  },
  hero: {
    titleA: 'Turn AI-written HTML',
    titleB: 'into a',
    titleAccent: 'click-to-edit',
    titleC: 'deck',
    subtitle:
      'Drop in any AI-generated HTML slides, then edit text, swap images and render Mermaid live — all WYSIWYG — and export to PPTX / PDF in one click.',
    ctaOpen: 'Open a file / drop it here',
    loading: 'Loading…',
    ctaGuide: 'Watch the 30-second guide',
    unsupported: 'Please open in Chrome / Edge or another Chromium browser',
    support: 'Works with a folder (read/write paired images) or a single self-contained HTML · Chromium browser required',
  },
  value: {
    eyebrow: 'Why NextPPT',
    titleA: 'AI can generate it, but',
    titleAccent: "you can't tweak it",
    subtitle: 'Leave that last step to us.',
    pains: [
      'No time to build a deck from scratch, so you hand the doc to an AI and let it generate the presentation.',
      'But AI-made PPTs often look crude — so more people switch to HTML pages, which are sharper and better designed.',
      'Yet the moment you want a new font, a tweaked palette or reworded copy, you go back to the chat and describe it all again — burning tokens and waiting on every round.',
    ],
    solution:
      '<brand>NextPPT</brand> lets you drop that HTML right in and click anything on the page to change fonts, colors and content — WYSIWYG, <em>no more spinning up a whole AI round just to fix one word</em>.',
  },
  hub: {
    unsupportedTitle: 'This browser cannot read or write local files',
    unsupportedBody:
      'This relies on the File System Access API, currently supported only by Chromium browsers. Please open this page in <a>Chrome</a> or Edge / Brave / Arc.',
    dropTitle: 'Click to choose, or drag a folder / HTML here',
    dropHint: 'Folder mode reads/writes paired images; a single HTML suits self-contained decks',
    openFolder: 'Open folder',
    openSingle: 'Open single HTML',
    recall: 'Reopen last folder',
    noDeck: "Don't have a deck yet?",
    sample: 'Try the sample',
    downloadSample: 'Download sample',
    aiHelp: 'Let AI write it',
    errorRecover:
      'No deck on hand? Use “Try the sample” or “Download sample” above, or <btn>see the format requirements</btn> to learn how to give your HTML a <code>{{tag}}</code>.',
  },
  preview: {
    eyebrow: 'Q3 Roadmap',
    heading: 'Turn a draft into a stage-ready deck',
    inspectorText: 'Text',
    inspectorLayout: 'Layout',
  },
  footer: {
    tagline: 'The next-gen deck, born from HTML. Local-first — your data never leaves your machine.',
    colProduct: 'Product',
    preview: 'Preview',
    start: 'Get started',
    colResources: 'Resources',
    guide: 'Guide',
    sample: 'Sample',
    colAbout: 'About',
    localFirst: 'Local-first',
    noLogin: 'No login',
    copy: '© {{year}} NextPPT',
  },
};

export default landing;
