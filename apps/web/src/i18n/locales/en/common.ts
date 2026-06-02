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
        "NextPPT guide: no HTML yet? Generate one with a prompt. Already have HTML? Run the format checklist. Then export to PPTX / PDF in one click.",
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
