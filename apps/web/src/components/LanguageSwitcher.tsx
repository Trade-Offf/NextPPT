import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { localePrefix, storeLocale, type Locale } from '../i18n/index.js';
import { useCurrentLocale } from '../hooks/useGuideNav.js';

/** Strip the leading /en (if any) to get the locale-agnostic subpath. */
function subpathOf(pathname: string, current: Locale): string {
  if (current === 'en') return pathname.replace(/^\/en/, '') || '/';
  return pathname;
}

/**
 * Toggles between zh / en while preserving the current subpath + hash, and
 * remembers the choice in localStorage so it sticks across visits.
 */
export function LanguageSwitcher() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { pathname, hash, search } = useLocation();
  const current = useCurrentLocale();

  const switchTo = (loc: Locale) => {
    if (loc === current) return;
    storeLocale(loc);
    const sub = subpathOf(pathname, current);
    const next = localePrefix(loc) + (sub === '/' ? '' : sub);
    navigate((next || '/') + search + hash);
  };

  return (
    <div className="hds-lang" role="group" aria-label={t('language.label')}>
      <button
        type="button"
        className={`hds-lang-btn ${current === 'zh' ? 'is-active' : ''}`}
        aria-pressed={current === 'zh'}
        onClick={() => switchTo('zh')}
      >
        {t('language.zh')}
      </button>
      <span className="hds-lang-sep" aria-hidden="true">/</span>
      <button
        type="button"
        className={`hds-lang-btn ${current === 'en' ? 'is-active' : ''}`}
        aria-pressed={current === 'en'}
        onClick={() => switchTo('en')}
      >
        {t('language.en')}
      </button>
    </div>
  );
}
