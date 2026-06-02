import type zh from '../zh/guide.js';

const guide: typeof zh = {
  header: {
    back: 'Back',
    backHome: 'Back to NextPPT',
    title: 'Guide',
    backToEdit: 'Back to editor',
    openFile: 'Open HTML file',
  },
  flow: {
    eyebrow: '30-second overview',
    steps: [
      { title: 'Get the HTML', desc: 'Write it yourself or have an AI generate a .html deck' },
      { title: 'Click to edit', desc: 'WYSIWYG: change text, swap images, render Mermaid' },
      { title: 'Export in one click', desc: 'Produce a projector-ready PPTX / PDF, all local' },
    ],
  },
  generate: {
    title: "I don't have HTML yet",
    intro:
      'This tool handles <strong>editing and export</strong>; leave content generation to any AI. Copy the prompt below and you are a few steps from a deck you can open directly.',
    steps: [
      { title: 'Copy the prompt', desc: 'Click “Copy prompt” at the top right to grab the whole prompt below.' },
      { title: 'Add a topic, hand it to an AI', desc: 'Replace {{topic}}, then send it to ChatGPT / Claude / Gemini / Cursor or any AI.' },
      { title: 'Save as .html', desc: 'Save the full code the AI returns as a single .html file (e.g. my-deck.html).' },
      { title: 'Come back and open it', desc: 'Return here, click “Open single HTML file” or drag the file in, and start clicking to edit and exporting.' },
    ],
    promptLabel: 'Prompt',
    copy: 'Copy prompt',
    copied: 'Copied',
    expand: 'Expand',
    collapse: 'Collapse',
    promptHint: 'Just “Copy prompt” and paste into any AI — no need to read it all. “Expand” when you want to double-check.',
    actionLabel: 'Already had the AI generate it?',
    openGenerated: 'Open the generated file',
  },
  existing: {
    title: 'I already have HTML',
    intro: 'Already have HTML? Meet the few rules below and you can open it directly. Most AI-made decks already qualify.',
    selfCheckLabel: 'Format checklist',
    selfCheck: [
      'Every page is a <section class="slide">, placed directly as a child of <body>.',
      'Each page is a fixed 1280×720 (16:9) with overflow: hidden so content never spills.',
      'All styles live in a <style> inside <head>; no linked local CSS files.',
      'Images/graphics use inline <svg>, data: URIs or absolute public https links — no relative paths.',
      'Text uses semantic tags like h1/h2/p/li/strong so you can click to edit in the editor.',
    ],
    mistakesLabel: 'Common mistakes',
    mistakes: [
      { label: 'Page container', good: '<section class="slide">', bad: '<div class="page"> or missing class="slide"' },
      { label: 'Canvas size', good: 'Fixed 1280px × 720px', bad: 'Percentages / auto height — export warps' },
      { label: 'Asset references', good: 'data: URI / absolute https links', bad: './img.png, assets/x.svg relative paths' },
      { label: 'Style location', good: 'Inside <head><style>', bad: 'Linked <link rel="stylesheet">' },
    ],
    actionLabel: 'Format all good?',
    openMine: 'Open my HTML',
  },
  export: {
    title: 'I want to export',
    intro: 'When you are happy, click “Export” at the top right to produce a projector-ready PPTX / PDF. Before exporting, note:',
    notes: [
      'The export is an “image-based” PPT / PDF: one hi-res image per page, with text no longer editable in PowerPoint. To change text, edit here and re-export.',
      'Before exporting it waits for fonts and Mermaid to finish rendering, then screenshots — complex pages being a bit slow is normal.',
      'Export range options: all pages / current page / custom page numbers (e.g. 1,3-5,8).',
      'Resolution tiers: Standard 2560×1440 is plenty for projection; HD / 4K is sharper but slower and larger.',
      'Everything is processed locally — your data never leaves your machine.',
    ],
    actionHasDeck: 'A deck is already open.',
    backToExport: 'Back to the editor to export',
    actionNoDeck: 'Open a deck first to export.',
    openFile: 'Open HTML file',
  },
  footer: {
    backHome: '← Back to NextPPT',
    local: 'Local-first · your data never leaves your machine',
  },
};

export default guide;
