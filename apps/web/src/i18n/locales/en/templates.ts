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
    openInEditor: 'Open in editor',
    download: 'Download HTML',
  },
  items: {
    'nextppt-kami': {
      title: 'Kami-style deck',
      desc: 'A NextPPT site intro typeset in the official Kami design language: background, features, usage and outcome, woven with maxims and design philosophy, restrained whitespace and serif-led hierarchy. Open it in the editor or download it; the bundled prompt is a generic Kami design spec you can reuse for any topic.',
    },
    'kami-doc': {
      title: 'Kami-style document',
      desc: 'Minimal whitespace, carefully typeset long-form / one-pager style.',
    },
    resume: {
      title: 'Kami-style resume',
      desc: 'A Chinese resume typeset in the official Kami design language (modelled on Musk\'s career, updated to 2026): metric masthead, three-step timeline, role/actions/impact projects, conviction calls and core skills — strict 2-page A4, serif-led hierarchy, ink-blue accents. Open or download it; the bundled prompt is a reusable Kami resume spec — just swap in your own history.',
    },
    longform: {
      title: 'Long-form report',
      desc: 'Long-form layout with sections and charts, exported with smart pagination.',
    },
    'deck-classic': {
      title: 'Classic deck',
      desc: 'A 16:9 multi-page deck following the section.slide protocol.',
    },
  },
};

export default templates;
