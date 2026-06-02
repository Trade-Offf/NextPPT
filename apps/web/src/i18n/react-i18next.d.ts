import 'react-i18next';
import type { zh } from './locales/zh/index.js';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: typeof zh;
  }
}
