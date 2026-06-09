import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useGuideNav, useLocalePrefix } from '../hooks/useGuideNav.js';
import { LanguageSwitcher } from './LanguageSwitcher.js';

interface SiteHeaderProps {
  /** Optional trailing node placed after the nav links (e.g. a "back to edit" CTA). */
  trailing?: ReactNode;
  /**
   * Skip the transparent→frosted hero transition and always render in the
   * frosted/bordered state. Use on pages without a full-bleed hero section
   * (Templates, Guide) where starting transparent makes no sense.
   *
   * Landing page omits this prop to keep its intentional hero fade-in.
   */
  alwaysScrolled?: boolean;
}

export function SiteHeader({ trailing, alwaysScrolled = false }: SiteHeaderProps) {
  const { t } = useTranslation('landing');
  const { openGuide } = useGuideNav();
  const navigate = useNavigate();
  const prefix = useLocalePrefix();
  const [scrolled, setScrolled] = useState(alwaysScrolled);

  useEffect(() => {
    // Pages without a hero (alwaysScrolled=true) stay permanently frosted —
    // no need to track window.scrollY at all.
    if (alwaysScrolled) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      setScrolled(window.scrollY > 8);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [alwaysScrolled]);

  return (
    <header className={`hds-nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center gap-6">
        <button
          onClick={() => navigate(prefix || '/')}
          className="flex items-center gap-2 shrink-0 transition-opacity hover:opacity-80"
          aria-label={t('nav.homeAria')}
        >
          <img src="/brand-n.png" alt="" className="hds-emblem w-7 h-7" />
          <span className="hds-wordmark text-sm">NextPPT</span>
        </button>

        <div className="ml-auto flex items-center gap-4 sm:gap-5">
          <button onClick={() => navigate(`${prefix}/templates`)} className="hds-nav-link">{t('nav.templates')}</button>
          <button onClick={() => navigate(`${prefix}/explore`)} className="hds-nav-link">{t('nav.explore')}</button>
          <button onClick={() => openGuide('generate')} className="hds-nav-link">{t('nav.guide')}</button>
          <span aria-hidden="true" className="w-px h-4 bg-[var(--separator)]" />
          <LanguageSwitcher />
          {trailing}
        </div>
      </div>
    </header>
  );
}
