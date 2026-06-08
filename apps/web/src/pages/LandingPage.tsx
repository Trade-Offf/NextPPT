import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useOpenDeck, DIR_API_SUPPORTED, FILE_API_SUPPORTED, FS_API_SUPPORTED } from '../fs/useOpenDeck.js';
import { gsap, useGSAP, revealOnScroll } from '../lib/gsap.js';
import { useGuideNav, useLocalePrefix } from '../hooks/useGuideNav.js';
import { SiteHeader } from '../components/SiteHeader.js';
import { EditorPreview } from '../components/EditorPreview.js';
import { SiteFluidBackdrop } from '../components/SiteFluidBackdrop.js';
import { OpenDeckErrorAlert } from '../components/OpenDeckErrorAlert.js';

export function LandingPage() {
  const { t } = useTranslation('landing');
  const { openGuide } = useGuideNav();
  const navigate = useNavigate();
  const prefix = useLocalePrefix();
  const {
    loading,
    error,
    formatError,
    dragOver,
    setDragOver,
    handlePickFolder,
    handlePickFile,
    handleRecall,
    handleDrop,
  } = useOpenDeck();

  const rootRef = useRef<HTMLDivElement>(null);
  const pains = t('value.pains', { returnObjects: true }) as string[];

  // SSG prerenders with no `window`, so FS_API_SUPPORTED is false on the server
  // but true in Chromium. Rendering the real value on the first client paint
  // diverges from the prerendered HTML and trips React #418/#419. Render the
  // optimistic "supported" branch until mounted (matches the prerender + the
  // vast majority of users), then correct for the rare unsupported browser.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const fsSupported = !mounted || FS_API_SUPPORTED;
  const dirSupported = !mounted || DIR_API_SUPPORTED;
  const fileSupported = !mounted || FILE_API_SUPPORTED;

  /** Main CTA / drop zone: open the HTML picker (folder via button below or drag).
   *  The workspace kind (PPT deck vs free-edit doc) is auto-detected on open. */
  const openPrimary = () => {
    if (loading) return;
    if (FILE_API_SUPPORTED) void handlePickFile();
    else if (DIR_API_SUPPORTED) void handlePickFolder();
  };

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.8 } })
          .from('.hero-h1', { autoAlpha: 0, y: 24 })
          .from('.hero-sub', { autoAlpha: 0, y: 18 }, '-=0.6')
          .from('.hero-cta', { autoAlpha: 0, y: 14 }, '-=0.6')
          .from('.hero-support', { autoAlpha: 0 }, '-=0.5')
          .from('.hero-preview', { autoAlpha: 0, y: 40 }, '-=0.5');

        revealOnScroll('.reveal-pain', { trigger: '.value-section', stagger: 0.12, y: 26 });
        revealOnScroll('.reveal-start', { trigger: '.value-section', y: 26 });
      });
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(['.hero-h1', '.hero-sub', '.hero-cta', '.hero-support', '.hero-preview',
          '.reveal-pain', '.reveal-start'], { autoAlpha: 1, y: 0 });
      });
    },
    { scope: rootRef },
  );

  return (
    <div
      ref={rootRef}
      className="hds-cinema relative w-full min-h-screen overflow-x-hidden"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="fixed inset-3 z-[60] pointer-events-none rounded-3xl border-2 border-dashed border-[var(--system-blue)] bg-[var(--cobalt-lt)]" aria-hidden="true" />
      )}

      <SiteFluidBackdrop />

      <div className="relative z-10">
      <SiteHeader />

      <section id="top" className="hds-hero relative px-6 pt-16 sm:pt-24 pb-16">
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h1 className="hero-h1 hds-hero-title hds-display text-[clamp(2.3rem,5.6vw,4rem)]">
            {t('hero.titleA')}<br className="hidden sm:block" />{t('hero.titleB')}<span className="hds-hero-accent"> {t('hero.titleAccent')} </span>{t('hero.titleC')}
          </h1>
          <p className="hero-sub mt-6 text-[15px] sm:text-[17px] text-[var(--secondary-label)] leading-relaxed max-w-xl mx-auto">
            {t('hero.subtitle')}
          </p>
          {error && (
            <OpenDeckErrorAlert
              className="mt-6 max-w-md mx-auto text-left"
              error={error}
              formatError={formatError}
              onGoToGuide={() => openGuide('generate')}
            />
          )}
          <div className={`hero-cta flex flex-wrap items-center justify-center gap-3 ${error ? 'mt-6' : 'mt-9'}`}>
            {fsSupported ? (
              <button onClick={openPrimary} disabled={loading} className="hds-btn-primary px-6 py-3 text-sm disabled:opacity-50">
                {loading ? t('hero.loading') : t('hero.ctaOpen')}
              </button>
            ) : (
              <span className="text-sm text-[var(--secondary-label)]">{t('hero.unsupported')}</span>
            )}
            <button onClick={() => openGuide('generate')} className="hds-btn px-5 py-3 text-sm">{t('hero.ctaGuide')}</button>
          </div>
          <p className="hero-support mt-4 text-xs text-[var(--tertiary-label)]">{t('hero.support')}</p>
        </div>

        <div id="preview" className="hero-preview relative z-10 mt-14 sm:mt-16 scroll-mt-20">
          <EditorPreview />
        </div>
      </section>

      <section id="start" className="value-section px-6 py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="reveal-pain hds-fig-label">{t('value.eyebrow')}</p>
            <h2 className="reveal-pain mt-3 text-3xl lg:text-[2.5rem] font-bold tracking-tight text-[var(--label)] leading-tight">
              {t('value.titleA')}<span className="hds-hero-accent">{t('value.titleAccent')}</span>
            </h2>
            <p className="reveal-pain mt-3 text-[15px] text-[var(--secondary-label)]">{t('value.subtitle')}</p>
            <div className="mt-8 flex flex-col gap-5">
              {pains.map((p, i) => (
                <div key={i} className="reveal-pain flex gap-4">
                  <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full border border-[var(--separator)] bg-white/[0.04] grid place-items-center text-[11px] font-mono text-[var(--secondary-label)]">{i + 1}</span>
                  <p className="text-[15px] text-[var(--secondary-label)] leading-relaxed">{p}</p>
                </div>
              ))}
            </div>
            <div className="reveal-pain mt-6 rounded-2xl border border-[var(--separator)] bg-white/[0.025] p-5">
              <p className="text-[15px] text-[var(--label)] leading-relaxed">
                <Trans
                  t={t}
                  i18nKey="value.solution"
                  components={{
                    brand: <span className="hds-hero-accent font-semibold" />,
                    em: <span className="font-medium" />,
                  }}
                />
              </p>
            </div>
          </div>

          <div className="reveal-start w-full max-w-md lg:justify-self-end">
            <div className="hds-glass-card p-7 sm:p-8">
            {!fsSupported ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-[var(--secondary-label)] leading-relaxed">
                <p className="font-medium text-[var(--label)] mb-1">{t('hub.unsupportedTitle')}</p>
                <p>
                  <Trans
                    t={t}
                    i18nKey="hub.unsupportedBody"
                    components={{
                      a: <a className="underline" href="https://www.google.com/chrome/" target="_blank" rel="noreferrer" />,
                    }}
                  />
                </p>
              </div>
            ) : (
              <>
                <div
                  onClick={openPrimary}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`relative w-full rounded-2xl px-6 py-14 flex flex-col items-center gap-3 text-center transition-all duration-200 group border-2 border-dashed cursor-pointer ${
                    dragOver ? 'border-[var(--system-blue)] bg-[var(--cobalt-lt)] scale-[1.01]' : 'border-[var(--rule)] hover:border-[var(--system-blue)] hover:bg-[var(--cobalt-lt)]'
                  } ${loading ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  <svg className="w-12 h-12 text-[var(--tertiary-label)] group-hover:text-[var(--system-blue)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  </svg>
                  <span className="text-sm font-medium text-[var(--label)] group-hover:text-[var(--system-blue)]">
                    {loading ? t('hero.loading') : t('hub.dropTitle')}
                  </span>
                  <span className="text-xs text-[var(--tertiary-label)] leading-relaxed">{t('hub.dropHint')}</span>
                </div>

                <div className="mt-4 flex items-center justify-center gap-2.5">
                  {dirSupported && (
                    <button onClick={handlePickFolder} disabled={loading} className="hds-btn-primary px-4 py-2 text-xs disabled:opacity-40">{t('hub.openFolder')}</button>
                  )}
                  {fileSupported && (
                    <button onClick={handlePickFile} disabled={loading} className="hds-btn px-4 py-2 text-xs disabled:opacity-40">{t('hub.openSingle')}</button>
                  )}
                </div>

                {dirSupported && (
                  <button onClick={handleRecall} disabled={loading} className="mt-3 text-xs text-[var(--system-blue)] hover:underline self-center disabled:opacity-40 block mx-auto">
                    {t('hub.recall')}
                  </button>
                )}
              </>
            )}

            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--separator)] px-6 py-12">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-sm">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2">
              <img src="/brand-n.png" alt="" className="hds-emblem w-6 h-6" />
              <span className="hds-wordmark">NextPPT</span>
            </div>
            <p className="mt-3 text-xs text-[var(--tertiary-label)] leading-relaxed">{t('footer.tagline')}</p>
            <div className="mt-4 flex items-center gap-2">
              <a
                href="https://github.com/Trade-Offf/NextPPT"
                target="_blank"
                rel="noreferrer"
                aria-label={t('footer.github')}
                title={t('footer.github')}
                className="w-8 h-8 rounded-lg border border-[var(--separator)] grid place-items-center text-[var(--secondary-label)] hover:text-[var(--label)] hover:border-[var(--rule)] transition"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
                </svg>
              </a>
              <a
                href="https://juejin.cn/user/1591748568038823"
                target="_blank"
                rel="noreferrer"
                aria-label={t('footer.juejin')}
                title={t('footer.juejin')}
                className="w-8 h-8 rounded-lg border border-[var(--separator)] grid place-items-center text-[var(--secondary-label)] hover:text-[var(--label)] hover:border-[var(--rule)] transition"
              >
                <svg width="16" height="16" viewBox="0 -2.4 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 14.316l7.454-5.794 2.453 1.913L12 19.119l-9.908-7.684 2.453-1.913L12 14.316zM12 0l9.908 7.684-2.453 1.913L12 4.092 4.545 9.597 2.092 7.684 12 0zm0 7.045l2.455 1.91L12 10.861l-2.455-1.906L12 7.045z" />
                </svg>
              </a>
              <a
                href="mailto:trade_offf@163.com"
                aria-label={t('footer.email')}
                title="trade_offf@163.com"
                className="w-8 h-8 rounded-lg border border-[var(--separator)] grid place-items-center text-[var(--secondary-label)] hover:text-[var(--label)] hover:border-[var(--rule)] transition"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2.5" />
                  <path d="m3.5 7.5 8.5 6 8.5-6" />
                </svg>
              </a>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--tertiary-label)] mb-3">{t('footer.colProduct')}</p>
            <ul className="space-y-2 text-[var(--secondary-label)]">
              <li><button onClick={() => document.getElementById('preview')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-[var(--label)]">{t('footer.preview')}</button></li>
              <li><button onClick={() => document.getElementById('start')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-[var(--label)]">{t('footer.start')}</button></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--tertiary-label)] mb-3">{t('footer.colResources')}</p>
            <ul className="space-y-2 text-[var(--secondary-label)]">
              <li><button onClick={() => openGuide('generate')} className="hover:text-[var(--label)]">{t('footer.guide')}</button></li>
              <li><button onClick={() => navigate(`${prefix}/templates`)} className="hover:text-[var(--label)]">{t('footer.templates')}</button></li>
              <li><a href="/sample-deck.html" download className="hover:text-[var(--label)]">{t('footer.sample')}</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--tertiary-label)] mb-3">{t('footer.colAbout')}</p>
            <ul className="space-y-2 text-[var(--secondary-label)]">
              <li><span>{t('footer.localFirst')}</span></li>
              <li><span>{t('footer.noLogin')}</span></li>
            </ul>
          </div>
        </div>
        <p className="max-w-5xl mx-auto mt-10 text-xs text-[var(--tertiary-label)]">{t('footer.copy', { year: new Date().getFullYear() })}</p>
      </footer>
      </div>
    </div>
  );
}
