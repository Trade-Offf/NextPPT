import { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useLocalePrefix } from '../hooks/useGuideNav.js';
import { useOpenDeck } from '../fs/useOpenDeck.js';
import { gsap, useGSAP } from '../lib/gsap.js';
import { SiteHeader } from '../components/SiteHeader.js';
import { SiteFluidBackdrop } from '../components/SiteFluidBackdrop.js';
import { TEMPLATES, findTemplate, type TemplateItem } from '../data/templates.js';
import { useEasterEggs } from '../hooks/useEasterEggs.js';

function SampleThumb({ url, kind }: { url: string; kind: TemplateItem['kind'] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const isDoc = kind === 'doc';
  const baseWidth = isDoc ? 794 : 1280;
  const scale = width / baseWidth;

  // Deck bodies use padding + flex-centering, which leaks body background as a
  // colored strip at the top/left. Inject a reset so the first slide is flush.
  const flushDeck = (e: { currentTarget: HTMLIFrameElement }) => {
    if (isDoc) return;
    try {
      const doc = e.currentTarget.contentDocument;
      if (!doc) return;
      const id = '__hds_preview_reset';
      let style = doc.getElementById(id) as HTMLStyleElement | null;
      if (!style) {
        style = doc.createElement('style');
        style.id = id;
        doc.head?.appendChild(style);
      }
      style.textContent =
        'html,body{margin:0!important;padding:0!important;gap:0!important;background:transparent!important;}';
    } catch {
      /* cross-origin or no document — leave the preview as-is */
    }
  };

  // Aspect ratio matches the real canvas: decks are 16:9, docs are A4 portrait.
  const aspect = isDoc ? '794 / 1123' : '16 / 9';

  return (
    <div
      ref={ref}
      className="w-full rounded-xl overflow-hidden"
      style={{ aspectRatio: aspect, position: 'relative', background: '#f5f4ed', boxShadow: 'inset 0 0 0 1px rgba(20,20,19,0.08)' }}
    >
      <iframe
        src={url}
        title="preview"
        tabIndex={-1}
        scrolling="no"
        aria-hidden="true"
        onLoad={flushDeck}
        style={{
          width: baseWidth,
          height: isDoc ? 1123 : 720,
          border: 0,
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `scale(${scale || 0.0001})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

export function TemplatesPage() {
  const { t } = useTranslation('templates');
  const navigate = useNavigate();
  const prefix = useLocalePrefix();
  const { state: easterState } = useEasterEggs();
  const rootRef = useRef<HTMLDivElement>(null);

  const visibleTemplates = useMemo(
    () => TEMPLATES.filter((item) => !item.easterEgg || easterState.terminalUnlocked),
    [easterState.terminalUnlocked],
  );

  // Layout: hero feature (nextppt-kami) + gallery featured (resume 2×2 + 4) + rest (3-col)
  const heroItem = visibleTemplates[0];
  const galleryFeatured = visibleTemplates[1];
  const galleryRight = visibleTemplates.slice(2, 6);
  const rest = visibleTemplates.slice(6);

  const openDetail = (id: string) => navigate(`${prefix}/templates/${id}`);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.7 } })
          .from('.tpl-hero-eyebrow', { autoAlpha: 0, y: 14 })
          .from('.tpl-hero-title', { autoAlpha: 0, y: 20 }, '-=0.5')
          .from('.tpl-hero-sub', { autoAlpha: 0, y: 14 }, '-=0.5')
          .from('.tpl-hero-count', { autoAlpha: 0, y: 10 }, '-=0.4')
          .from('.tpl-hero-feature', { autoAlpha: 0, y: 24, scale: 0.98 }, '-=0.5')
          .from('.tpl-card', { autoAlpha: 0, y: 28, stagger: 0.06 }, '-=0.3');
      });
    },
    { scope: rootRef, dependencies: [] },
  );

  return (
    <div ref={rootRef} className="hds-cinema relative w-full min-h-[100dvh] overflow-x-clip">
      <SiteFluidBackdrop />
      <div className="relative z-10">
        <SiteHeader alwaysScrolled />

        <main className="max-w-6xl mx-auto px-6 sm:px-8 pt-12 sm:pt-16 pb-24">
          <header className="tpl-hero">
            <div className="tpl-hero-text">
              <p className="tpl-hero-eyebrow">{t('hero.eyebrow')}</p>
              <h1 className="tpl-hero-title">{t('hero.title')}</h1>
              <p className="tpl-hero-sub">{t('hero.subtitle')}</p>
              <p className="tpl-hero-count">
                <strong>{String(visibleTemplates.length).padStart(2, '0')}</strong>
                <span>curated templates · local-first</span>
              </p>
            </div>
            {heroItem && (
              <button
                onClick={() => openDetail(heroItem.id)}
                className="tpl-hero-feature"
                aria-label={t('card.viewDetail')}
              >
                <div className="tpl-hero-feature-thumb">
                  <span className="tpl-hero-feature-num">N° 01 · Featured</span>
                  {heroItem.sampleUrl ? (
                    <SampleThumb url={heroItem.sampleUrl} kind={heroItem.kind} />
                  ) : (
                    <div className="w-full aspect-[16/9] grid place-items-center border border-dashed border-[var(--rule)] bg-white/[0.03]">
                      <span className="text-[11px] text-[var(--tertiary-label)]">{t('detail.previewPlaceholder')}</span>
                    </div>
                  )}
                </div>
                <div className="tpl-hero-feature-meta">
                  <div className="tpl-hero-feature-meta-left">
                    <span className="tpl-hero-feature-name">{t(`items.${heroItem.id}.title`)}</span>
                    <span className="tpl-hero-feature-kind">
                      {heroItem.kind === 'deck' ? t('card.deck') : t('card.doc')}
                    </span>
                  </div>
                  <span className="tpl-hero-feature-cta">
                    {t('card.viewDetail')}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </span>
                </div>
              </button>
            )}
          </header>

          {galleryFeatured && (
            <div className="tpl-gallery-featured">
              <TemplateCard
                item={galleryFeatured}
                index={2}
                onOpen={() => openDetail(galleryFeatured.id)}
                featured
              />
              <div className="tpl-gallery-right">
                {galleryRight.map((item, i) => (
                  <TemplateCard
                    key={item.id}
                    item={item}
                    index={3 + i}
                    onOpen={() => openDetail(item.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {rest.length > 0 && (
            <div className="tpl-gallery-rest">
              {rest.map((item, i) => (
                <TemplateCard
                  key={item.id}
                  item={item}
                  index={7 + i}
                  onOpen={() => openDetail(item.id)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const prefix = useLocalePrefix();
  const rootRef = useRef<HTMLDivElement>(null);

  const item = id ? findTemplate(id) : undefined;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.tpl-detail', { autoAlpha: 0, y: 20, duration: 0.5, ease: 'power3.out' });
      });
    },
    { scope: rootRef, dependencies: [id] },
  );

  if (!item) {
    navigate(`${prefix}/templates`, { replace: true });
    return null;
  }

  return (
    <div ref={rootRef} className="hds-cinema relative w-full min-h-[100dvh] overflow-x-clip">
      <SiteFluidBackdrop />
      <div className="relative z-10">
        <SiteHeader alwaysScrolled hideProgress />
        <main className="max-w-6xl mx-auto px-6 sm:px-8 pt-12 sm:pt-16 pb-24">
          <TemplateDetail item={item} onBack={() => navigate(`${prefix}/templates`)} />
        </main>
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: TemplateItem['kind'] }) {
  const { t } = useTranslation('templates');
  return (
    <span className={`tpl-kind ${kind === 'doc' ? 'is-doc' : ''}`}>
      {kind === 'deck' ? t('card.deck') : t('card.doc')}
    </span>
  );
}

function TemplateCard({ item, index, onOpen, featured }: { item: TemplateItem; index: number; onOpen: () => void; featured?: boolean }) {
  const { t } = useTranslation('templates');
  const num = String(index).padStart(2, '0');
  return (
    <button
      onClick={onOpen}
      className={`tpl-card ${featured ? 'is-featured' : ''}`}
    >
      <div className="tpl-card-thumb">
        <span className="tpl-card-num">N° {num}</span>
        {item.sampleUrl ? (
          <SampleThumb url={item.sampleUrl} kind={item.kind} />
        ) : (
          <div className="w-full aspect-[16/9] grid place-items-center border border-dashed border-[var(--rule)] bg-white/[0.03]">
            <span className="text-[11px] text-[var(--tertiary-label)]">{t('detail.previewPlaceholder')}</span>
          </div>
        )}
      </div>
      <div className="tpl-card-meta">
        <div className="tpl-card-head">
          <h3 className="tpl-card-name">{t(`items.${item.id}.title`)}</h3>
          <KindBadge kind={item.kind} />
        </div>
        <p className="tpl-card-desc">{t(`items.${item.id}.desc`)}</p>
        <div className="tpl-card-foot">
          <div className="tpl-card-tags">
            {item.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="tpl-card-tag">{tag}</span>
            ))}
          </div>
          <span className="tpl-card-cta">
            View
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </span>
        </div>
      </div>
    </button>
  );
}

function TemplateDetail({ item, onBack }: { item: TemplateItem; onBack: () => void }) {
  const { t } = useTranslation('templates');
  const navigate = useNavigate();
  const prefix = useLocalePrefix();
  const { openTemplateSample, loading, error } = useOpenDeck();
  const hasMotion = Boolean(item.motionPrompt && item.motionSampleUrl);
  const [motionMode, setMotionMode] = useState(false);
  const [promptOpen, setPromptOpen] = useState<{ static: boolean; motion: boolean }>({ static: false, motion: false });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // When motion is unavailable, force static. Stays in sync if item changes.
  useEffect(() => {
    if (!hasMotion) setMotionMode(false);
  }, [hasMotion]);

  const activePrompt = motionMode ? (item.motionPrompt ?? item.prompt) : item.prompt;
  const activeSampleUrl = motionMode ? (item.motionSampleUrl ?? item.sampleUrl) : item.sampleUrl;

  const copyText = async (text: string | undefined, key: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  // Single-prompt copy (used in the non-motion layout)
  const copy = () => copyText(activePrompt, 'single');

  const openInEditor = async () => {
    if (!activeSampleUrl) return;
    const fileName = activeSampleUrl.split('/').pop() || 'sample.html';
    // Motion HTML carries JS animations that the PPT editor would strip.
    // Route it to the HTML workbench via the same sessionStorage channel
    // the homepage split-drop uses.
    if (motionMode) {
      try {
        const res = await fetch(activeSampleUrl);
        const text = await res.text();
        sessionStorage.setItem(
          'hds_pending_html',
          JSON.stringify({ name: fileName, text }),
        );
        navigate(`${prefix}/html`);
        return;
      } catch {
        /* fetch failed — fall back to the deck editor */
      }
    }
    const ok = await openTemplateSample(activeSampleUrl, fileName);
    if (ok) navigate(prefix || '/');
  };

  return (
    <div className="tpl-detail">
      <button onClick={onBack} className="tpl-detail-back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 19l-7-7 7-7" /></svg>
        {t('detail.back')}
      </button>

      <div className="tpl-detail-grid">
        <div className="tpl-detail-preview">
          {/* Variant toggle — Linear editorial style: text labels + hairline indicator */}
          {hasMotion && (
            <div className="tpl-detail-variant-toggle" role="tablist" aria-label={t('detail.variantLabel')}>
              <button
                role="tab"
                aria-selected={!motionMode}
                onClick={() => setMotionMode(false)}
                className={`tpl-detail-variant-btn ${!motionMode ? 'is-active' : ''}`}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round"><rect x="1" y="1" width="8" height="8" /><path d="M3 4h4M3 6h2.5" /></svg>
                {t('detail.static')}
              </button>
              <button
                role="tab"
                aria-selected={motionMode}
                onClick={() => setMotionMode(true)}
                className={`tpl-detail-variant-btn is-motion ${motionMode ? 'is-active' : ''}`}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M1 5c1.5-2 2.5-2 4 0s2.5 2 4 0" /></svg>
                {t('detail.motion')}
              </button>
            </div>
          )}
          <div className="tpl-detail-preview-frame">
            {activeSampleUrl ? (
              <SampleThumb url={activeSampleUrl} kind={item.kind} />
            ) : (
              <div className="w-full aspect-[16/9] grid place-items-center border border-dashed border-[var(--rule)] bg-white/[0.03]">
                <span className="text-[13px] text-[var(--tertiary-label)]">{t('detail.previewPlaceholder')}</span>
              </div>
            )}
          </div>
          {activeSampleUrl && (
            <div className="tpl-detail-actions">
              <button onClick={openInEditor} disabled={loading} className="hds-btn-primary px-5 py-2 text-xs disabled:opacity-50">
                {motionMode ? t('detail.openInWorkbench') : t('detail.openInEditor')}
              </button>
              <a href={activeSampleUrl} download className="hds-btn px-4 py-2 text-xs">{t('detail.download')}</a>
            </div>
          )}
          {error && (
            <div className="mt-3 text-xs text-[var(--system-red,#ef4444)]">{error}</div>
          )}
        </div>

        {/* Right: meta flow */}
        <div className="tpl-detail-body">
          <p className="tpl-detail-eyebrow">
            {item.kind === 'deck' ? t('card.deck') : t('card.doc')} · Template
          </p>
          <h1 className="tpl-detail-title">{t(`items.${item.id}.title`)}</h1>
          <p className="tpl-detail-desc">{t(`items.${item.id}.desc`)}</p>

          <div className="tpl-detail-meta-bar">
            <div className="tpl-detail-meta-item">
              <span className="tpl-detail-meta-label">Type</span>
              <span className="tpl-detail-meta-value">{item.kind === 'deck' ? t('card.deck') : t('card.doc')}</span>
            </div>
            <div className="tpl-detail-meta-item">
              <span className="tpl-detail-meta-label">Tags</span>
              <span className="tpl-detail-meta-value">{item.tags.length} categories</span>
            </div>
            {item.credit && (
              <div className="tpl-detail-meta-item">
                <span className="tpl-detail-meta-label">Source</span>
                <a href={item.credit.href} target="_blank" rel="noreferrer" className="tpl-detail-meta-value tpl-detail-meta-link">
                  {item.credit.name}
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4, opacity: 0.6, display: 'inline-block', verticalAlign: 'baseline' }}><path d="M3 7L7 3M7 3H4M7 3v3" /></svg>
                </a>
              </div>
            )}
          </div>

          {/* Usage */}
          <section style={{ marginTop: 20 }}>
            <p className="tpl-detail-section-label">{t('detail.usageTitle')}</p>
            <p className="text-sm text-[var(--secondary-label)] leading-relaxed max-w-[56ch]">{t('detail.usage')}</p>
          </section>
        </div>
      </div>

      {/* Prompt — full-width row below the grid. Static left, Motion right. */}
      <section className={`tpl-detail-prompt-section ${hasMotion ? 'is-dual' : ''}`}>
        {hasMotion ? (
          <div className="tpl-detail-prompt-dual">
            <div className="tpl-detail-prompt-col">
              <div className="tpl-detail-prompt-head">
                <span className="tpl-detail-prompt-label">
                  {t('detail.promptTitle')}
                  <span className="tpl-detail-prompt-variant-tag">{t('detail.static')}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPromptOpen((v) => ({ ...v, static: !v.static }))}
                    aria-expanded={promptOpen.static}
                    className="tpl-detail-prompt-toggle"
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: promptOpen.static ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M3 4.5l3 3 3-3" /></svg>
                    {promptOpen.static ? t('detail.collapse') : t('detail.expand')}
                  </button>
                  <button onClick={() => copyText(item.prompt, 'static')} className="tpl-detail-prompt-copy">
                    {copiedKey === 'static' ? t('detail.copied') : t('detail.copyPrompt')}
                  </button>
                </div>
              </div>
              {promptOpen.static ? (
                <pre className="tpl-detail-prompt-expanded">{item.prompt || t('detail.todo')}</pre>
              ) : (
                <button
                  onClick={() => item.prompt && setPromptOpen((v) => ({ ...v, static: true }))}
                  disabled={!item.prompt}
                  className="tpl-detail-prompt-collapsed disabled:opacity-60"
                >
                  {item.prompt ? t('detail.promptHint') : t('detail.todo')}
                </button>
              )}
            </div>

            <div className="tpl-detail-prompt-col">
              <div className="tpl-detail-prompt-head">
                <span className="tpl-detail-prompt-label">
                  {t('detail.promptTitle')}
                  <span className="tpl-detail-prompt-variant-tag">{t('detail.motion')}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPromptOpen((v) => ({ ...v, motion: !v.motion }))}
                    aria-expanded={promptOpen.motion}
                    className="tpl-detail-prompt-toggle"
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: promptOpen.motion ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M3 4.5l3 3 3-3" /></svg>
                    {promptOpen.motion ? t('detail.collapse') : t('detail.expand')}
                  </button>
                  <button onClick={() => copyText(item.motionPrompt, 'motion')} className="tpl-detail-prompt-copy">
                    {copiedKey === 'motion' ? t('detail.copied') : t('detail.copyPrompt')}
                  </button>
                </div>
              </div>
              {promptOpen.motion ? (
                <pre className="tpl-detail-prompt-expanded">{item.motionPrompt || t('detail.todo')}</pre>
              ) : (
                <button
                  onClick={() => item.motionPrompt && setPromptOpen((v) => ({ ...v, motion: true }))}
                  disabled={!item.motionPrompt}
                  className="tpl-detail-prompt-collapsed disabled:opacity-60"
                >
                  {item.motionPrompt ? t('detail.promptHint') : t('detail.todo')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="tpl-detail-prompt-head">
              <span className="tpl-detail-prompt-label">
                {t('detail.promptTitle')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPromptOpen((v) => ({ ...v, static: !v.static }))}
                  disabled={!activePrompt}
                  aria-expanded={promptOpen.static}
                  className="tpl-detail-prompt-toggle disabled:opacity-40"
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: promptOpen.static ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M3 4.5l3 3 3-3" /></svg>
                  {promptOpen.static ? t('detail.collapse') : t('detail.expand')}
                </button>
                <button onClick={copy} disabled={!activePrompt} className="tpl-detail-prompt-copy disabled:opacity-40">
                  {copiedKey === 'single' ? t('detail.copied') : t('detail.copyPrompt')}
                </button>
              </div>
            </div>
            {promptOpen.static ? (
              <pre className="tpl-detail-prompt-expanded">{activePrompt || t('detail.todo')}</pre>
            ) : (
              <button
                onClick={() => activePrompt && setPromptOpen((v) => ({ ...v, static: true }))}
                disabled={!activePrompt}
                className="tpl-detail-prompt-collapsed disabled:opacity-60"
              >
                {activePrompt ? t('detail.promptHint') : t('detail.todo')}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
