import './index.css';
import { ViteReactSSG } from 'vite-react-ssg';
import { routes } from './routes.js';
import { localePrefix, readStoredLocale, type Locale } from './i18n/index.js';

/**
 * Client-only soft redirect to the preferred language. Language is otherwise
 * decided purely by the URL prefix (so prerendered shells and crawlers stay
 * stable); here we honour a stored preference, or fall back to the browser
 * language when none is set. Never runs during prerender, and is idempotent
 * (the stored/derived preference matches the target after redirecting).
 */
function redirectByPreference() {
  const { pathname, search, hash } = window.location;
  const onEn = pathname === '/en' || pathname.startsWith('/en/');
  const current: Locale = onEn ? 'en' : 'zh';
  const stored = readStoredLocale();
  const desired: Locale =
    stored ?? (navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en');
  if (desired === current) return;
  const sub = onEn ? pathname.replace(/^\/en/, '') || '/' : pathname;
  const target = (localePrefix(desired) + (sub === '/' ? '' : sub) || '/') + search + hash;
  if (target !== pathname + search + hash) window.location.replace(target);
}

export const createRoot = ViteReactSSG({ routes }, ({ isClient }) => {
  if (isClient) redirectByPreference();
});
