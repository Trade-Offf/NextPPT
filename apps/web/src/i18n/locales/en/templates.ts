import type zh from '../zh/templates.js';

const templates: typeof zh = {
  hero: {
    eyebrow: 'Templates',
    title: 'Pick a starting point and let AI generate it',
    subtitle:
      'A curated gallery of HTML-generation prompts and tools. Copy a prompt into your AI tool to generate the HTML, then come back and open it in "PPT mode" or "Free-edit" to edit and export. NextPPT does not generate.',
    back: 'Back to home',
  },
  card: {
    deck: 'Deck',
    doc: 'Free doc',
    viewDetail: 'View details',
  },
  detail: {
    back: 'Back to list',
    previewTitle: 'Preview',
    previewPlaceholder: 'Preview placeholder (to be added)',
    promptTitle: 'Prompt',
    copyPrompt: 'Copy prompt',
    copied: 'Copied to clipboard',
    expand: 'Expand',
    collapse: 'Collapse',
    promptHint: 'Click to expand the full Kami design spec (colors, type, spacing, shadows, components, charts, anti-patterns). Or just "Copy prompt".',
    todo: 'Prompt text to be added.',
    usageTitle: 'How to use',
    usage: 'Copy the prompt into your AI tool to generate the HTML, then open it back here in the matching mode to edit and export.',
    creditPrefix: 'Design system by',
    openInEditor: 'Open in editor',
    download: 'Download HTML',
  },
  carousel: {
    open: 'Open in Editor',
  },
  items: {
    'nextppt-kami': {
      title: 'Kami-style deck',
      desc: 'A NextPPT site intro typeset in the official Kami design language: background, features, usage and outcome, woven with maxims and design philosophy, restrained whitespace and serif-led hierarchy. Open it in the editor or download it; the bundled prompt is a generic Kami design spec you can reuse for any topic.',
    },
    resume: {
      title: 'Kami-style resume',
      desc: 'A Chinese resume typeset in the official Kami design language (modelled on Musk\'s career, updated to 2026): metric masthead, three-step timeline, role/actions/impact projects, conviction calls and core skills, strict 2-page A4, serif-led hierarchy, ink-blue accents. Open or download it; the bundled prompt is a reusable Kami resume spec, just swap in your own history.',
    },
    'deck-classic': {
      title: 'Terminal-style deck',
      desc: 'A multi-page deck in a GitHub-dark / terminal-IDE aesthetic (a developer-view AI productivity talk): IDE titlebars, "//" kicker prefixes, pain/fix scenario cards, syntax-highlighted code panels, golden-quote bands and metric cards, accented by terminal orange and JetBrains Mono. Open it in the editor or download it; the bundled prompt is a reusable terminal-style design spec for any topic.',
    },
    'deck-report': {
      title: 'Business report deck',
      desc: 'A light, business-style multi-page report deck (project-management analysis view): a health donut, a risk-priority pyramid, a resource heat matrix, a capacity line chart and a main-line relay flow, five inline SVG charts, plus health-status lights, P0/P1/P2 level pills, color-topped cards and an action table, accented in ink navy with a single sans-serif for projector readability. Open it in the editor or download it; the bundled prompt is a reusable business-report design spec for any topic.',
    },
    'sakura-chroma': {
      title: 'Sakura Chroma',
      desc: 'A multi-page deck on cream paper with brown ink and a restrained six-color rainbow ribbon: petal-cluster covers, diagonal rainbow chapter ribbons, 12-point starburst seals, halftone paper texture, Big Shoulders Display for titles. Open it in the editor or download it; the bundled prompt is a reusable Sakura Chroma design spec for any topic.',
    },
    'cobalt-grid': {
      title: 'Cobalt Grid',
      desc: 'A multi-page deck on ivory paper with electric cobalt blue and a faint-blue graph-paper grid: pixel-staircase SVGs, QR blocks, hairline dividers, Newsreader italic for pull quotes, DM Mono for data. Open it in the editor or download it; the bundled prompt is a reusable Cobalt Grid design spec for any topic.',
    },
    'peoples-platform': {
      title: "People's Platform · Block & Bold",
      desc: 'A multi-page deck on cream paper with bold blue/orange/red color blocks: Alfa Slab One mega-titles with layered text-shadow stamp effect, grain noise overlay, heavy black borders, high visual impact. Open it in the editor or download it; the bundled prompt is a reusable Block & Bold design spec for any topic.',
    },
    'long-table': {
      title: 'Long Table',
      desc: 'A multi-page deck on warm cream with a single restrained rust-red accent: outlined pill buttons, circular edition badges, rect tags and seats pills, Bricolage Grotesque all-caps titles + Fraunces italic for pull quotes, tabular menu layouts. Open it in the editor or download it; the bundled prompt is a reusable Long Table design spec for any topic.',
    },
    'brutalist-newspaper': {
      title: 'Brutalist Newspaper',
      desc: 'A multi-page deck on newsprint cream with a single spot-red and halftone monochrome images in Brutalist newspaper style: dense 12-column grid, Libre Caslon Text serif masthead, drop caps, stamps, column dividers and data tables — like a folded newspaper. Open it in the editor or download it; the bundled prompt is a reusable Brutalist newspaper design spec for any topic. Inspired by hugohe3/ppt-master.',
    },
    'bloomberg-editorial': {
      title: 'Bloomberg Data Editorial',
      desc: 'A multi-page deck on near-white paper with deep navy and amber/green semantic colors in Bloomberg / Economist data-journalism editorial style: 8-column main+sidebar grid, Source Serif Pro headlines, micro line/bar/donut/sankey/scatter/heat-matrix charts, editor\'s note sidebars, source lines. Open it in the editor or download it; the bundled prompt is a reusable Bloomberg data-editorial design spec for any topic. Inspired by hugohe3/ppt-master.',
    },
    'swiss-grid': {
      title: 'Swiss Grid',
      desc: 'A multi-page deck on warm off-white with red-black duotone in Swiss International Typographic style: strict 12-column grid, Inter sans throughout, Display 96-128px type, asymmetric balance, negative space as design language, geometric blocks / grid guides / minimal bar charts — an homage to Josef Müller-Brockmann. Open it in the editor or download it; the bundled prompt is a reusable Swiss grid design spec for any topic. Inspired by hugohe3/ppt-master.',
    },
  },
};

export default templates;
