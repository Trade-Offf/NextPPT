import { Component, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Head } from 'vite-react-ssg';
import { I18nextProvider } from 'react-i18next';
import { getI18n, localePrefix, type Locale } from '../i18n/index.js';

const SITE = 'https://next-ppt.com';

type Page = 'home' | 'guide' | 'explore';

function pageFromPath(pathname: string): Page {
  if (pathname.endsWith('/guide')) return 'guide';
  if (pathname.includes('/explore')) return 'explore';
  return 'home';
}

function urlFor(locale: Locale, page: Page): string {
  const prefix = localePrefix(locale);
  if (page === 'guide') return `${SITE}${prefix}/guide`;
  if (page === 'explore') return `${SITE}${prefix}/explore`;
  return `${SITE}${prefix || '/'}`;
}

/**
 * Global error boundary — the last line of defence against a white screen.
 * Any uncaught render error (e.g. a malformed deck triggering an exception
 * deep in the editor tree) is caught here and replaced with a calm, actionable
 * fallback instead of an empty page. The user can retry (reset state) or
 * reload; the original error is logged for debugging.
 */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[hds] Uncaught render error:', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    const isZh = document.documentElement.lang?.startsWith('zh');
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafafa',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{
          maxWidth: '420px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 8px' }}>
            {isZh ? '出了点问题' : 'Something went wrong'}
          </h1>
          <p style={{ fontSize: '14px', color: '#666', margin: '0 0 24px', lineHeight: 1.6 }}>
            {isZh
              ? '页面渲染时遇到意外错误。你可以重试，或刷新页面重新开始。'
              : 'An unexpected error occurred while rendering. You can retry, or reload the page to start fresh.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={this.reset}
              style={{
                padding: '8px 20px',
                fontSize: '14px',
                fontWeight: 500,
                border: '1px solid #d0d0d0',
                borderRadius: '6px',
                background: '#fff',
                color: '#1a1a1a',
                cursor: 'pointer',
              }}
            >
              {isZh ? '重试' : 'Retry'}
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 20px',
                fontSize: '14px',
                fontWeight: 500,
                border: 'none',
                borderRadius: '6px',
                background: '#1a1a1a',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {isZh ? '刷新页面' : 'Reload'}
            </button>
          </div>
        </div>
      </div>
    );
  }
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
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </I18nextProvider>
  );
}
