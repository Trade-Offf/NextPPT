import type zh from '../zh/landing.js';

const landing: typeof zh = {
  nav: {
    homeAria: 'NextPPT home',
    guide: 'Guide',
    templates: 'Templates',
    explore: 'Explore',
    htmlWorkbench: 'HTML Deck',
  },
  hero: {
    titleA: 'HTML is the',
    titleB: 'next-gen',
    titleAccent: 'presentation container',
    subtitle:
      'More vivid than PPT, richer than markdown, more intuitive than Excel. Drop in an AI-generated HTML deck, edit text and images, keep the animations and interactions intact, project it straight to the stage.',
    loading: 'Loading…',
    ctaUpload: 'Upload file',
    ctaGuide: 'Watch the 30-second guide',
  },
  error: {
    retry: 'Retry',
    sample: 'Try sample',
  },
  value: {
    eyebrow: 'Why HTML',
    titleA: 'Generation is no longer the bottleneck.',
    titleAccent: 'distribution is',
    subtitle: 'AI floods us with information, but being seen is where value begins.',
    pains: [
      'AI ended the generation bottleneck. Docs, data, proposals, all in one sentence.',
      'But distribution became the new bottleneck: PPT is too static, markdown too flat, Excel too opaque. HTML can animate, interact, and go real-time, born to be seen.',
      'The only catch: to tweak one word or nudge one element in an AI-generated HTML, you go back to the chat and describe it again. Generation and editing should not be coupled.',
    ],
    solution:
      '<brand>NextPPT</brand> decouples generation from editing. Drop the HTML in, click to edit, text, position, scale, WYSIWYG. We touch only what you change, <em>never rewriting your scripts or animations</em>. Export, HTML in, HTML out. Animations keep running, interactions keep working.',
  },
  hub: {
    dragHint: 'Or drop a file / folder anywhere',
    modePrompt: 'Choose how to open',
    modeSubtitle: 'Two editors for different presentation needs',
    modeHtml: 'HTML Deck',
    modeHtmlDesc: 'Keeps animations and interactions; edit text and position in place',
    modeHtmlEnter: 'Enter',
    modePpt: 'PPT Editor',
    modePptDesc: 'Paginated editing; export to PPTX / PDF',
    modePptEnter: 'Enter',
    modeCancel: 'Cancel',
    dropSplitHint: 'Drop left for HTML Deck, right for PPT Editor',
    dropLeftTitle: 'HTML Deck',
    dropLeftHint: 'Keeps animations & interactions',
    dropLeftCta: 'Release to open HTML Deck',
    dropRightTitle: 'PPT Editor',
    dropRightHint: 'Paginated, export PPTX',
    dropRightCta: 'Release to open PPT Editor',
    dropDivider: 'or',
    dropHtmlOnly: 'HTML Deck only supports .html files',
  },
  preview: {
    eyebrow: 'Q3 Roadmap',
    heading: 'Turn a draft into a stage-ready deck',
    editing: 'editing',
    chartLabel: 'live chart',
    mermaidLabel: 'mermaid',
    changesLabel: 'Changes',
    searchLabel: 'Search',
    searchPlaceholder: 'Find text…',
  },
  parallel: {
    pass: 'PARALLEL BACKSTAGE PASS',
    tag: 'Parallel World',
    eyebrow: 'PARALLEL UNIVERSE · FOR FUN',
    titleA: 'In a parallel world,',
    titleAccent: 'they all use NextPPT',
    subtitle: 'Six familiar faces share how NextPPT feels in their parallel universe.',
    disclaimer:
      'Disclaimer: This section is fictional. The portraits are AI-generated and every quote is AI-imagined, they do not represent the views of any real person, and are purely for entertainment.',
    people: [
      {
        name: 'Luo Yonghao',
        role: 'Idealist · Keynote-Aesthetics Evangelist',
        quote:
          'A real keynote should be dynamic in every frame. What PPT cannot do, text fading in, charts drawing themselves, backgrounds shifting with mood, HTML can. This is not a PPT upgrade, it is redoing presentation itself.',
        scene: 'The livestream lights come on; he drags the launch HTML into NextPPT, bumps the title font so the back row can read it, and not one line of animation breaks.',
        tags: ['Redo presentation', 'Dynamic every frame', 'HTML on stage'],
      },
      {
        name: 'Hu Yanbin',
        role: 'Music Producer · Parallel-Universe CXO',
        quote:
          'Music is a time art, and presentation should be too. HTML lets the frame move with the rhythm; PPT can only flip pages. This is not a tool difference, it is a dimensional difference.',
        scene: 'Late night in the studio, he drags the tour visuals into NextPPT, humming the melody while tuning each frame to land right on the hook.',
        tags: ['Time art', 'Move with rhythm', 'Dimensional gap'],
      },
      {
        name: 'Steve Jobs',
        role: 'Product Philosopher',
        quote:
          'The essence of presentation is putting an idea into someone’s eyes. PPT is a fixed frame; HTML is a room that breathes. The future of demos should live in the browser.',
        scene: 'At the garage whiteboard he stares at the projection and says only: make it move, and the HTML elements actually start breathing.',
        tags: ['A room that breathes', 'Live in browser', 'Essence of presentation'],
      },
      {
        name: 'Elon Musk',
        role: 'First-Principles Maniac',
        quote:
          'PPT is last century’s slide; HTML is this century’s living page. It carries real-time data, interactions, APIs. That, by first principles, is what information should look like.',
        scene: 'Late at the factory, between two launch windows, he drags the mission brief into NextPPT, reworks it in five minutes, and rocket telemetry pulses live on the page.',
        tags: ['Living page', 'Real-time data', 'First principles'],
      },
      {
        name: 'Jensen Huang',
        role: 'Compute Evangelist',
        quote:
          'Every important piece of information will be seen as HTML in the future, because it carries compute, interaction, real-time rendering. PPT was for the slide-projector era; HTML is for the compute era.',
        scene: 'In his leather jacket backstage at GTC, he drags the keynote into NextPPT, doubles the 3D model’s spin speed on the spot, and the GPU renders it live.',
        tags: ['Compute era', 'Real-time rendering', 'HTML is the future'],
      },
      {
        name: 'Allen Zhang',
        role: 'Aesthete of Restraint',
        quote:
          'A good container should make you forget the container exists. Drag the HTML in, edit, share, one link opens it, no install, no conversion, no waiting. That is what distribution should feel like.',
        scene: 'At a quiet desk he opens no dialog at all, just a few clicks to tune the deck to exactly right, then sends it out as one link.',
        tags: ['Forget the container', 'One link', 'Distribution done right'],
      },
    ],
  },
  footer: {
    tagline: 'The next-gen presentation container, this generation is HTML. Rendered locally, never uploaded.',
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
