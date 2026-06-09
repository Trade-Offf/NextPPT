import type zh from '../zh/guide.js';

const guide: typeof zh = {
  header: {
    back: 'Back',
    backHome: 'Back to NextPPT',
    title: 'Guide',
    backToEdit: 'Back to editor',
  },
  flow: {
    eyebrow: 'Three simple steps',
    steps: [
      { title: 'Let AI make it', desc: 'Send one prompt to any AI and get a ready-made deck back' },
      { title: 'Click to edit', desc: 'Click to change text, drag to move things — no code needed' },
      { title: 'Turn it into a PPT', desc: 'Export a projector-ready PPT / PDF, all on your computer' },
    ],
  },
  generate: {
    title: 'Step 1 · Let AI make one for you',
    intro: "Can't build it yourself? No problem. Copy the prompt below into any AI and it hands you a ready-made deck file you can come back and edit.",
    promptWhat: 'A prompt is just a sentence that tells the AI what to make for you.',
    steps: [
      { title: 'Copy this prompt', desc: 'Click "Copy prompt" below — the whole thing is copied, nothing to write yourself.' },
      { title: 'Send it to an AI, add your topic', desc: 'Paste it into ChatGPT, Claude, Gemini, Copilot or any AI, and replace {{topic}} with your subject.' },
      { title: 'Save the file', desc: 'The AI returns some code; save it as a file as instructed (any name, e.g. my-deck.html).' },
      { title: 'Come back and open it', desc: 'Go back to the home page, open a folder or drag the file in, and start editing.' },
    ],
    promptLabel: 'Prompt to copy',
    copy: 'Copy prompt',
    copied: 'Copied',
    expand: 'See what it says',
    collapse: 'Collapse',
    promptHint: 'No need to read it — just "Copy prompt" and paste into any AI. Curious? "See what it says".',
    actionLabel: 'Already got the file from the AI?',
    openGenerated: 'Open that file',
  },
  edit: {
    title: 'Step 2 · Click to edit',
    intro: 'Once the file is open, editing feels just like editing a PPT — point and drag with your mouse, no code at all.',
    demoHint: 'Click any text on the page and the panel on the right lets you change it.',
    abilities: [
      { title: 'Click text to change it', desc: 'Click a piece of text, then edit its content, size, color and alignment in the right panel.' },
      { title: 'Double-click to type in place', desc: 'Want it faster? Double-click the text and type the new content right where it is.' },
      { title: 'Swap an image', desc: 'Select an image and drag a new one in — it is replaced instantly.' },
      { title: 'Move things freely (Move mode)', desc: 'Switch to "Move" up top to drag, resize from corners, or Delete any element; switch back to "Edit" to only change text without nudging things.' },
      { title: 'Undo any mistake', desc: 'Cmd+Z to undo, Shift+Cmd+Z to redo; the top-left "History" lets you roll back anytime.' },
      { title: 'Auto-save', desc: 'Changes save back into the file you opened automatically — nothing to click, nothing to lose.' },
    ],
    actionLabel: 'Want to try it now?',
    openMine: 'Open a file and start editing',
  },
  export: {
    title: 'Step 3 · Turn it into a PPT / PDF',
    intro: "Happy with it? Click \"Export\" at the top right to get a file you can project or share.",
    notes: [
      'The export is a set of hi-res images (like a photo of each page). So you cannot edit the text inside PowerPoint — to change text, edit here and export again.',
      'You can export just some pages: all pages, or your own page numbers (e.g. 1,3-5,8).',
      'Pick a sharpness: Standard is plenty for projecting; higher is sharper but slower and larger.',
      'Complex pages take a little longer — that is just the images and charts finishing rendering, which is normal.',
      'Editing and saving happen entirely on your computer; only when you click Export is the file sent to the rendering server to produce images, then deleted right after.',
    ],
    actionHasDeck: 'A deck is already open.',
    backToExport: 'Back to export',
    actionNoDeck: 'Open a deck first to export.',
    openFile: 'Open a file',
  },
  footer: {
    backHome: '← Back to NextPPT',
    local: 'Local-first · files stay on your computer',
  },
};

export default guide;
