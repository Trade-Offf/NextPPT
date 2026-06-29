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
    ctaUpload: 'Upload file',
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
    dragHint: 'Or drag a folder / HTML file anywhere onto the page',
    choosePrompt: 'What do you want to open?',
    chooseCancel: 'Cancel',
    openFolder: 'Open folder',
    openSingle: 'Open single HTML',
    recall: 'Reopen last folder',
    errorRecover:
      'This file may be in the wrong format to open. The easiest fix is to <btn>have an AI remake it</btn> with our prompt.',
  },
  sampleShowcase: {
    eyebrow: 'Built-in samples',
    title: 'Open 4 ready-made decks in one click',
    subtitle:
      'No files to prepare, no folder to pick — jump straight into the editor and start editing, swapping images, and exporting.',
    noFsNote:
      'Your browser cannot read or write local files yet, but you can still open the built-in sample and try editing and exporting.',
    loading: 'Loading sample…',
    openError: 'The sample failed to load. Please try again later or open an HTML file manually.',
    open: 'Open',
    openInEditor: 'Open in editor',
    cards: [
      {
        title: 'Product Launch',
        subtitle: 'Keynote / product launch',
        desc: 'Multi-page titles with image & copy pairs — perfect for product launches and quarterly updates.',
      },
      {
        title: 'Quarterly Roadmap',
        subtitle: 'Roadmap / strategy',
        desc: 'Layered structure with highlight sections — great for internal reviews and team syncs.',
      },
      {
        title: 'Portfolio Deck',
        subtitle: 'Portfolio / resume deck',
        desc: 'Image-first showcase pages — ideal for turning a resume or portfolio into a projector-ready deck.',
      },
      {
        title: 'Tech Talk',
        subtitle: 'Tech talk / conference',
        desc: 'Code blocks and diagram pages — built for conferences, internal sharing, and teaching.',
      },
    ],
  },
  preview: {
    eyebrow: 'Q3 Roadmap',
    heading: 'Turn a draft into a stage-ready deck',
    inspectorText: 'Text',
    inspectorLayout: 'Layout',
  },
  parallel: {
    pass: 'PARALLEL BACKSTAGE PASS',
    tag: 'Parallel World',
    eyebrow: 'PARALLEL UNIVERSE · FOR FUN',
    titleA: 'In a parallel world,',
    titleAccent: 'they all use NextPPT',
    subtitle: 'Six familiar faces share how NextPPT feels in their parallel universe.',
    disclaimer:
      'Disclaimer: This section is fictional. The portraits are AI-generated and every quote is AI-imagined — they do not represent the views of any real person, and are purely for entertainment.',
    people: [
      {
        name: 'Luo Yonghao',
        role: 'Idealist · Keynote-Aesthetics Evangelist',
        quote:
          'A keynote deck is a craft. I used to stay up till dawn fixing one slide; now a click changes text and images — let me use it first, and make a friend.',
        scene: 'The moment the livestream lights go on, he drags his launch keynote into NextPPT and, cracking jokes, bumps the font up so even the back row can read it.',
        tags: ['Craft-grade layout', 'One-click edit', 'One-click export'],
      },
      {
        name: 'Hu Yanbin',
        role: 'Music Producer · Parallel-Universe CXO',
        quote:
          'Making a deck is like writing a song — the hook needs endless polish. I used to spin up a whole AI round for one edit; now a single click changes text and colors. The inspiration never drops.',
        scene: 'Late night in the studio, he drags his tour keynote into NextPPT and nails the titles while humming the melody.',
        tags: ['Click to edit', 'Stay in flow', 'One-click export'],
      },
      {
        name: 'Steve Jobs',
        role: 'Product Philosopher',
        quote:
          'True simplicity is handing the last millimeter of polish back to people. NextPPT deletes every extra step and leaves just one — the click.',
        scene: 'At the garage whiteboard he stares at the projection and says only: make that bigger — then clicks it himself.',
        tags: ['Minimal interaction', 'Pixel control', 'WYSIWYG'],
      },
      {
        name: 'Elon Musk',
        role: 'First-Principles Maniac',
        quote:
          'A deck should not be the bottleneck. Decouple generation from editing and you iterate an order of magnitude faster — that is first principles.',
        scene: 'Late at the factory, between two launch windows, he drags the mission brief in and reworks it in five minutes before going on stage.',
        tags: ['Rapid iteration', 'Decoupled gen', 'Straight to stage'],
      },
      {
        name: 'Jensen Huang',
        role: 'Compute Evangelist',
        quote:
          'The more you edit, the more you save — every AI recompute you skip is compute saved.',
        scene: 'In his leather jacket backstage at GTC, he drags the keynote into NextPPT and swaps the palette to the next-gen recipe on the spot.',
        tags: ['Saves compute', 'Live editing', 'One-click export'],
      },
      {
        name: 'Allen Zhang',
        role: 'Aesthete of Restraint',
        quote:
          'A good tool should let you finish and leave. Drag the HTML in, edit, export — no distraction. That is my kind of taste.',
        scene: 'At a quiet desk he opens no dialog at all, just a few clicks to tune the deck until it is exactly right.',
        tags: ['Finish and leave', 'Calm & clean', 'WYSIWYG'],
      },
    ],
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
