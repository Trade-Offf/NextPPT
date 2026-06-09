import type zh from '../zh/common.js';

const common: typeof zh = {
  brand: 'NextPPT',
  tagline: 'The next-gen deck, born from HTML',
  seo: {
    ogSiteName: 'NextPPT',
    home: {
      title: 'NextPPT — The next-gen deck, born from HTML',
      description:
        'NextPPT turns AI-written HTML slides into a click-to-edit deck you can export to PPTX / PDF in one click. No login, fully local.',
    },
    guide: {
      title: 'Guide · NextPPT — The next-gen deck, born from HTML',
      description:
        'NextPPT guide: no deck yet? Generate one with a prompt. Then click to change text and images, move things around, and export a projector-ready PPT / PDF in one click. Fully local.',
    },
    explore: {
      title: 'Explore · NextPPT — The next-gen deck, born from HTML',
      description:
        'NextPPT Explore: a collection of AI content workflows we have validated — like having AI generate a Draw.io file that becomes element-level editable and collaborative once imported into a Lark whiteboard.',
    },
  },
  language: {
    label: 'Switch language',
    zh: '中文',
    en: 'English',
  },
  confirm: 'OK',
  cancel: 'Cancel',
  close: 'Close',
};

export default common;
