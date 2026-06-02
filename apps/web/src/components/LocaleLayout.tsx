import { Outlet, useLocation } from 'react-router-dom';
import { Head } from 'vite-react-ssg';
import { I18nextProvider } from 'react-i18next';
import { getI18n, localePrefix, type Locale } from '../i18n/index.js';

const SITE = 'https://next-ppt.com';

type Page = 'home' | 'guide';

function pageFromPath(pathname: string): Page {
  return pathname.endsWith('/guide') ? 'guide' : 'home';
}

function urlFor(locale: Locale, page: Page): string {
  const prefix = localePrefix(locale);
  if (page === 'guide') return `${SITE}${prefix}/guide`;
  return `${SITE}${prefix || '/'}`;
}

/**
 * Sets the active language from the route prefix and owns the document head for
 * that locale + page (title / description / canonical / hreflang / og), so each
 * prerendered shell is SEO-correct and the client stays in sync.
 */
export function LocaleLayout({ locale }: { locale: Locale }) {
  const i18n = getI18n(locale);
  const { pathname } = useLocation();
  const page = pageFromPath(pathname);
  const t = i18n.getFixedT(locale, 'common');

  const title = t(`seo.${page}.title`);
  const description = t(`seo.${page}.description`);
  const htmlLang = locale === 'zh' ? 'zh-CN' : 'en';
  const ogLocale = locale === 'zh' ? 'zh_CN' : 'en_US';
  const canonical = urlFor(locale, page);
  const zhUrl = urlFor('zh', page);
  const enUrl = urlFor('en', page);
  const ogImage = `${SITE}/og-image.png`;

  return (
    <I18nextProvider i18n={i18n} defaultNS="common">
      <Head>
        <html lang={htmlLang} />
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <link rel="alternate" hrefLang="zh-Hans" href={zhUrl} />
        <link rel="alternate" hrefLang="en" href={enUrl} />
        <link rel="alternate" hrefLang="x-default" href={zhUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={t('seo.ogSiteName')} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content={ogLocale} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
      </Head>
      <Outlet />
    </I18nextProvider>
  );
}
