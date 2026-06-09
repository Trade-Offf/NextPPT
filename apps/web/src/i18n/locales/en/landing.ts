import type zh from '../zh/landing.js';

const landing: typeof zh = {
  nav: {
    homeAria: 'NextPPT home',
    guide: 'Guide',
    templates: 'Templates',
    explore: 'Explore',
    openFile: 'Open file',
  },
  hero: {
    titleA: 'Turn AI-written HTML',
    titleB: 'into a',
    titleAccent: 'click-to-edit',
    titleC: 'deck',
    subtitle:
      'Drop in an AI-generated deck, then click to change text, swap images and move things around — and export a projector-ready PPT / PDF in one click.',
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
    dropHint: 'PPT decks or resumes / long docs alike — format auto-detected; folder mode reads/writes paired images',
    choosePrompt: 'What do you want to open?',
    chooseCancel: 'Cancel',
    openFolder: 'Open folder',
    openSingle: 'Open single HTML',
    recall: 'Reopen last folder',
    errorRecover:
      'This file may be in the wrong format to open. The easiest fix is to <btn>have an AI remake it</btn> with our prompt.',
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
    templates: 'Templates',
    sample: 'Sample',
    colAbout: 'About',
    localFirst: 'Local-first',
    noLogin: 'No login',
    github: 'GitHub',
    juejin: 'Juejin',
    email: 'Email',
    copy: '© {{year}} NextPPT',
  },
};

export default landing;
