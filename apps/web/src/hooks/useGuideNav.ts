import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { GuideTab } from '../data/guide.js';
import type { Locale } from '../i18n/index.js';

/** Current locale derived purely from the URL path prefix. */
export function useCurrentLocale(): Locale {
  const { pathname } = useLocation();
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'zh';
}

/** '' for zh (no prefix), '/en' for en. */
export function useLocalePrefix(): string {
  return useCurrentLocale() === 'en' ? '/en' : '';
}

/**
 * Guide navigation as real router transitions (replacing the old store overlay).
 * Keeps the active locale prefix so /guide and /en/guide stay within-language.
 */
export function useGuideNav() {
  const navigate = useNavigate();
  const prefix = useLocalePrefix();

  const openGuide = useCallback(
    (anchor?: GuideTab) => {
      navigate(`${prefix}/guide${anchor ? `#${anchor}` : ''}`);
    },
    [navigate, prefix],
  );

  const closeGuide = useCallback(() => {
    navigate(prefix || '/');
  }, [navigate, prefix]);

  return { openGuide, closeGuide };
}
