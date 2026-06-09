import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLocalePrefix } from '../hooks/useGuideNav.js';
import { SiteHeader } from '../components/SiteHeader.js';
import { SiteFluidBackdrop } from '../components/SiteFluidBackdrop.js';
import { EXPLORE, type ExploreItem } from '../data/explore.js';

export function ExplorePage() {
  const { t } = useTranslation('explore');
  const navigate = useNavigate();
  const prefix = useLocalePrefix();

  return (
    <div className="hds-cinema relative w-full min-h-screen overflow-x-hidden">
      <SiteFluidBackdrop />
      <div className="relative z-10">
        <SiteHeader alwaysScrolled />

        <main className="max-w-6xl mx-auto px-6 pt-16 sm:pt-24 pb-20">
          <header className="max-w-2xl">
            <p className="hds-fig-label">{t('hero.eyebrow')}</p>
            <h1 className="mt-3 text-3xl lg:text-[2.6rem] font-bold tracking-tight text-[var(--label)] leading-tight">
              {t('hero.title')}
            </h1>
            <p className="mt-4 text-[15px] text-[var(--secondary-label)] leading-relaxed">
              {t('hero.subtitle')}
            </p>
            <button
              onClick={() => navigate(prefix || '/')}
              className="hds-btn px-4 py-2 text-xs mt-6"
            >
              {t('hero.back')}
            </button>
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
      className="hds-glass-card p-5 text-left flex flex-col gap-3 transition-transform hover:-translate-y-0.5"
    >
      <div
        className="w-full rounded-xl overflow-hidden"
        style={{ aspectRatio: '16 / 9', boxShadow: 'inset 0 0 0 1px rgba(20,20,19,0.08)' }}
      >
        <img src={item.cover} alt="" className="w-full h-full object-cover" loading="lazy" />
      </div>
      <h3 className="text-[15px] font-semibold text-[var(--label)]">{t(`items.${item.slug}.title`)}</h3>
      <p className="text-[13px] text-[var(--secondary-label)] leading-relaxed">{t(`items.${item.slug}.desc`)}</p>
      <span className="text-xs text-[var(--system-blue)] mt-auto">{t('readMore')} →</span>
    </button>
  );
}
