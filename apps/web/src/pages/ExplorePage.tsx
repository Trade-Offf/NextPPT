import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLocalePrefix } from '../hooks/useGuideNav.js';
import { gsap, useGSAP } from '../lib/gsap.js';
import { SiteHeader } from '../components/SiteHeader.js';
import { SiteFluidBackdrop } from '../components/SiteFluidBackdrop.js';
import { EXPLORE, type ExploreItem } from '../data/explore.js';

export function ExplorePage() {
  const { t } = useTranslation('explore');
  const navigate = useNavigate();
  const prefix = useLocalePrefix();
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.7 } })
          .from('.explore-eyebrow', { autoAlpha: 0, y: 14 })
          .from('.explore-title', { autoAlpha: 0, y: 20 }, '-=0.5')
          .from('.explore-sub', { autoAlpha: 0, y: 14 }, '-=0.5')
          .from('.explore-card', { autoAlpha: 0, y: 24, stagger: 0.08 }, '-=0.4');
      });
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="hds-cinema relative w-full min-h-[100dvh] overflow-x-clip">
      <SiteFluidBackdrop />
      <div className="relative z-10">
        <SiteHeader alwaysScrolled />

        <main className="max-w-7xl mx-auto px-6 pt-16 sm:pt-24 pb-20">
          <header className="max-w-xl">
            <p className="explore-eyebrow hds-fig-label">{t('hero.eyebrow')}</p>
            <h1 className="explore-title mt-4 text-3xl lg:text-[2.6rem] font-bold tracking-tight text-[var(--label)] leading-tight">
              {t('hero.title')}
            </h1>
            <p className="explore-sub mt-4 text-[15px] text-[var(--secondary-label)] leading-relaxed">
              {t('hero.subtitle')}
            </p>
          </header>

          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {EXPLORE.map((item) => (
              <ExploreCard
                key={item.slug}
                item={item}
                onOpen={() => navigate(`${prefix}/explore/${item.slug}`)}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

function ExploreCard({ item, onOpen }: { item: ExploreItem; onOpen: () => void }) {
  const { t } = useTranslation('explore');
  return (
    <button
      onClick={onOpen}
      className="explore-card hds-glass-card group p-6 text-left flex flex-col gap-3 transition-transform hover:-translate-y-1"
    >
      <div
        className="w-full rounded-xl overflow-hidden"
        style={{ aspectRatio: '16 / 9', boxShadow: 'inset 0 0 0 1px rgba(20,20,19,0.08)' }}
      >
        <img
          src={item.cover}
          alt=""
          width={480}
          height={270}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />
      </div>
      <h3 className="text-[15px] font-semibold text-[var(--label)]">{t(`items.${item.slug}.title`)}</h3>
      <p className="text-[13px] text-[var(--secondary-label)] leading-relaxed">{t(`items.${item.slug}.desc`)}</p>
      <span className="text-xs text-[var(--system-blue)] mt-auto inline-flex items-center gap-1.5">
        {t('readMore')}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-300 group-hover:translate-x-1"
          aria-hidden="true"
        >
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  );
}
