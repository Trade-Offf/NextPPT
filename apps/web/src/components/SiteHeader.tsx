import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGuideNav, useLocalePrefix } from '../hooks/useGuideNav.js';
import { LanguageSwitcher } from './LanguageSwitcher.js';
import { useLogoEasterEgg, EasterEggModal } from './EasterEggRobot.js';

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
  const location = useLocation();
  const prefix = useLocalePrefix();
  // Continuous scroll progress is tracked via ref + direct DOM writes, never
  // through React state — Taste Skill §5.D: scrolling progress is a continuous
  // value, useState here would re-render the tree on every frame.
  const headerRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const easter = useLogoEasterEgg();
  const [menuOpen, setMenuOpen] = useState(false);

  // Strip the locale prefix so `/en/templates` and `/templates` both match.
  // The home path is the prefix itself (or `/`).
  const path = location.pathname;
  const section = prefix ? path.replace(prefix, '') || '/' : path;
  const isActive = (seg: string) => section === seg || section.startsWith(`${seg}/`);

  // Close the mobile menu on route change.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // ESC + click-outside close the mobile menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      // Ignore clicks on the burger itself (it toggles via its own onClick)
      // and anything inside the header (panel + links + switcher).
      if (!target || headerRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [menuOpen]);

  // Close the mobile menu on scroll — avoids the panel drifting away from
  // the bar on long pages and matches Linear/Apple dropdown conventions.
  useEffect(() => {
    if (!menuOpen) return;
    let closed = false;
    const onScroll = () => {
      if (closed) return;
      closed = true;
      setMenuOpen(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true, once: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [menuOpen]);

  useEffect(() => {
    if (alwaysScrolled) {
      // No transition needed; progress bar still tracks scroll position.
      headerRef.current?.classList.add('is-scrolled');
    }

    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      // Direct DOM write — no React state for continuous scroll value.
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${ratio})`;
      }
      if (!alwaysScrolled && headerRef.current) {
        headerRef.current.classList.toggle('is-scrolled', window.scrollY > 8);
      }
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    update();
    // Use document.scrollingElement events; the rAF does NOT touch React state,
    // so this is compliant with Taste Skill §5.D (rAF only writes DOM directly).
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [alwaysScrolled]);

  // Shared nav link cluster — rendered in the desktop bar and the mobile panel.
  const navLinks = (
    <>
      <button onClick={() => navigate(`${prefix}/html`)} className={`hds-nav-link ${isActive('/html') ? 'is-active' : ''}`}>{t('nav.htmlWorkbench')}</button>
      <button onClick={() => navigate(`${prefix}/templates`)} className={`hds-nav-link ${isActive('/templates') ? 'is-active' : ''}`}>{t('nav.templates')}</button>
      <button onClick={() => navigate(`${prefix}/explore`)} className={`hds-nav-link ${isActive('/explore') ? 'is-active' : ''}`}>{t('nav.explore')}</button>
      <button onClick={() => openGuide('generate')} className={`hds-nav-link ${isActive('/guide') ? 'is-active' : ''}`}>{t('nav.guide')}</button>
    </>
  );

  return (
    <header ref={headerRef} className={`hds-nav ${alwaysScrolled ? 'is-scrolled' : ''} ${menuOpen ? 'is-menu-open' : ''}`}>
      <div className="max-w-7xl mx-auto px-6 sm:px-8 h-14 flex items-center gap-6">
        <button
          onClick={(e) => {
            easter.handleLogoClick(e);
            navigate(prefix || '/');
          }}
          className="flex items-center gap-2 shrink-0 transition-opacity duration-200 hover:opacity-80"
          aria-label={t('nav.homeAria')}
        >
          <img src="/brand-n.png" alt="" width={28} height={28} className="hds-emblem w-7 h-7" />
          <span className="hds-wordmark text-sm">NextPPT</span>
          <span className="hds-nav-version">v2</span>
        </button>

        {/* Desktop nav — visible md+ */}
        <div className="hidden md:flex ml-auto items-center gap-1.5">
          {navLinks}
          <span aria-hidden="true" className="w-px h-4 bg-[var(--separator)]" />
          <LanguageSwitcher />
          {trailing}
        </div>

        {/* Mobile right cluster — trailing (optional) + burger */}
        <div className="ml-auto md:hidden flex items-center gap-2">
          {trailing}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={`hds-nav-burger ${menuOpen ? 'is-open' : ''}`}
            aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={menuOpen}
            aria-controls="hds-nav-mobile-panel"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel — sticky under the bar, vibrancy surface */}
      {menuOpen && (
        <div
          id="hds-nav-mobile-panel"
          className="hds-nav-mobile-panel md:hidden"
          role="dialog"
          aria-modal="false"
          aria-label={t('nav.menuLabel')}
        >
          <nav className="max-w-7xl mx-auto px-6 sm:px-8 py-2 flex flex-col">
            {navLinks}
          </nav>
          <div className="hds-nav-mobile-foot max-w-7xl mx-auto px-6 sm:px-8 py-3 flex items-center">
            <LanguageSwitcher />
          </div>
        </div>
      )}

      {/* Scroll progress indicator — Linear-style 2px line at the nav bottom.
          transform is written directly by the rAF loop above (ref), never via
          React state — see Taste Skill §5.D. */}
      <span
        ref={progressRef}
        className="hds-nav-progress"
        style={{ transform: 'scaleX(0)' }}
        aria-hidden="true"
      />

      {/* +1s floating indicators on rapid logo clicks */}
      {easter.plusOnes.map((p) => (
        <span
          key={p.id}
          className="easter-plus-one"
          style={{ left: p.x, top: p.y }}
          aria-hidden="true"
        >
          +1s
        </span>
      ))}

      {/* Secret code modal after 7-click unlock */}
      <EasterEggModal open={easter.modalOpen} onClose={() => easter.setModalOpen(false)} />
    </header>
  );
}
