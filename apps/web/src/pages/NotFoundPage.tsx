import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Head } from 'vite-react-ssg';
import { useLocalePrefix } from '../hooks/useGuideNav.js';
import { SiteFluidBackdrop } from '../components/SiteFluidBackdrop.js';

export function NotFoundPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const prefix = useLocalePrefix();

  return (
    <div className="hds-cinema relative w-full min-h-[100dvh] overflow-x-hidden">
      <Head>
        <title>{t('notFound.title')}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <SiteFluidBackdrop />
      <div className="relative z-10 min-h-[100dvh] grid place-items-center px-6">
        <div className="text-center">
          <p className="hds-display text-[clamp(4rem,12vw,8rem)] font-bold leading-none text-[var(--label)]">
            {t('notFound.code')}
          </p>
          <p className="mt-4 text-[15px] text-[var(--secondary-label)]">
            {t('notFound.message')}
          </p>
          <button
            onClick={() => navigate(`${prefix || '/'}`)}
            className="hds-btn-primary mt-8 px-6 py-3 text-sm"
          >
            {t('notFound.cta')}
          </button>
        </div>
      </div>
    </div>
  );
}
