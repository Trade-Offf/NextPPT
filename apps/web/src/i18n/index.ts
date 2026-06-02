import i18next, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { zh } from './locales/zh/index.js';
import { en } from './locales/en/index.js';

export type Locale = 'zh' | 'en';

export const LOCALES: readonly Locale[] = ['zh', 'en'];
export const DEFAULT_LOCALE: Locale = 'zh';
export const NAMESPACES = ['common', 'landing', 'guide', 'editor', 'prompt'] as const;

export const resources = { zh, en } as const;

const STORAGE_KEY = 'hds_lang';

/**
 * One i18next instance per locale. Each instance is initialised synchronously
 * (`initAsync: false`) with both locales bundled, so server-side rendering
 * (vite-react-ssg) and the client share the exact same, ready-to-render text.
 */
const cache = new Map<Locale, I18nInstance>();

export function getI18n(locale: Locale): I18nInstance {
  const cached = cache.get(locale);
  if (cached) return cached;

  const instance = i18next.createInstance();
  instance.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    ns: NAMESPACES as unknown as string[],
    defaultNS: 'common',
    // Synchronous init (resources are bundled) so SSR renders ready text.
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  cache.set(locale, instance);
  return instance;
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'zh' || value === 'en';
}

/** Locale prefix for building URLs: '' for zh (default, no prefix), '/en' for en. */
export function localePrefix(locale: Locale): string {
  return locale === 'zh' ? '' : `/${locale}`;
}

/** Persisted language preference (client only). */
export function readStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

export function storeLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}
