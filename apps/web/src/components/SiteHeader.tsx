import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGuideNav } from '../hooks/useGuideNav.js';
import { LanguageSwitcher } from './LanguageSwitcher.js';

interface Props {
  /** Primary action — open a deck (folder / single file). */
  onOpen: () => void;
  /** Whether opening files is supported in this browser. */
  canOpen: boolean;
}

export function SiteHeader({ onOpen, canOpen }: Props) {
  const { t } = useTranslation('landing');
  const { openGuide } = useGuideNav();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`hds-nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center gap-6">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2 shrink-0 transition-opacity hover:opacity-80"
          aria-label={t('nav.homeAria')}
        >
          <img src="/brand-n.png" alt="" className="hds-emblem w-7 h-7" />
          <span className="hds-wordmark text-sm">NextPPT</span>
        </button>

        <div className="ml-auto flex items-center gap-4 sm:gap-5">
          <button onClick={() => openGuide('generate')} className="hds-nav-link">{t('nav.guide')}</button>
          <LanguageSwitcher />
          {canOpen && (
            <button onClick={onOpen} className="hds-btn-primary px-4 py-1.5 text-xs">{t('nav.openFile')}</button>
          )}
        </div>
      </div>
    </header>
  );
}
