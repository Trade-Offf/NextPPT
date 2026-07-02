import { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { state: easterState } = useEasterEggs();
  const rootRef = useRef<HTMLDivElement>(null);

  const visibleTemplates = useMemo(
    () => TEMPLATES.filter((item) => !item.easterEgg || easterState.terminalUnlocked),
    [easterState.terminalUnlocked],
  );
  const selected = selectedId ? findTemplate(selectedId) : undefined;

  // When the number of cards is odd, the last card also spans 2 columns so the
  // bento grid closes without an empty cell.
  const lastSpan = visibleTemplates.length % 2 === 1 ? 'lg:col-span-2' : '';

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (selected) {
          // Detail panel slides in from the right when a template is opened.
          gsap.from('.tpl-detail', { autoAlpha: 0, x: 30, duration: 0.5, ease: 'power3.out' });
        } else {
          gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.7 } })
            .from('.tpl-eyebrow', { autoAlpha: 0, y: 14 })
            .from('.tpl-title', { autoAlpha: 0, y: 20 }, '-=0.5')
            .from('.tpl-sub', { autoAlpha: 0, y: 14 }, '-=0.5')
            .from('.tpl-card', { autoAlpha: 0, y: 24, stagger: 0.08 }, '-=0.4');
        }
      });
    },
    { scope: rootRef, dependencies: [selected] },
  );

  return (
    <div ref={rootRef} className="hds-cinema relative w-full min-h-[100dvh] overflow-x-hidden">
      <SiteFluidBackdrop />
      <div className="relative z-10">
        <SiteHeader alwaysScrolled />

        <main className="max-w-7xl mx-auto px-6 pt-16 sm:pt-24 pb-20">
          {!selected ? (
            <>
              <header className="max-w-xl">
                <p className="tpl-eyebrow hds-fig-label">{t('hero.eyebrow')}</p>
                <h1 className="tpl-title mt-4 text-3xl lg:text-[2.6rem] font-bold tracking-tight text-[var(--label)] leading-tight">
                  {t('hero.title')}
                </h1>
                <p className="tpl-sub mt-4 text-[15px] text-[var(--secondary-label)] leading-relaxed">
                  {t('hero.subtitle')}
                </p>
              </header>

              <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5 grid-flow-dense">
                {visibleTemplates.map((item, i) => (
                  <TemplateCard
                    key={item.id}
                    item={item}
                    onOpen={() => setSelectedId(item.id)}
                    className={i === 0 ? 'lg:col-span-2' : i === visibleTemplates.length - 1 ? lastSpan : ''}
                  />
                ))}
              </div>
            </>
          ) : (
            <TemplateDetail item={selected} onBack={() => setSelectedId(null)} />
          )}
        </main>
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: TemplateItem['kind'] }) {
  const { t } = useTranslation('templates');
  return (
    <span
      className={
        kind === 'deck'
          ? 'text-[10px] font-medium px-2 py-0.5 rounded-full border border-[rgba(139,147,232,0.35)] bg-[rgba(139,147,232,0.08)] text-[var(--system-blue)]'
          : 'text-[10px] font-medium px-2 py-0.5 rounded-full border border-[var(--separator)] text-[var(--secondary-label)]'
      }
    >
      {kind === 'deck' ? t('card.deck') : t('card.doc')}
    </span>
  );
}

function TemplateCard({ item, onOpen, className = '' }: { item: TemplateItem; onOpen: () => void; className?: string }) {
  const { t } = useTranslation('templates');
  return (
    <button
      onClick={onOpen}
      className={`tpl-card hds-glass-card group p-6 text-left flex flex-col gap-3 transition-transform hover:-translate-y-1 ${className}`}
    >
      {/* Live preview when a sample exists, else a placeholder */}
      {item.sampleUrl ? (
        <SampleThumb url={item.sampleUrl} kind={item.kind} />
      ) : (
        <div className="w-full aspect-[16/9] rounded-xl border border-dashed border-[var(--rule)] bg-white/[0.03] grid place-items-center">
          <span className="text-[11px] text-[var(--tertiary-label)]">{t('detail.previewPlaceholder')}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-[var(--label)]">{t(`items.${item.id}.title`)}</h3>
        <KindBadge kind={item.kind} />
      </div>
      <p className="text-[13px] text-[var(--secondary-label)] leading-relaxed">{t(`items.${item.id}.desc`)}</p>
      <span className="text-xs text-[var(--system-blue)] mt-auto inline-flex items-center gap-1.5">
        {t('card.viewDetail')}
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

function TemplateDetail({ item, onBack }: { item: TemplateItem; onBack: () => void }) {
  const { t } = useTranslation('templates');
  const navigate = useNavigate();
  const prefix = useLocalePrefix();
  const { openTemplateSample, loading, error } = useOpenDeck();
  const [copied, setCopied] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  const copy = async () => {
    if (!item.prompt) return;
    try {
      await navigator.clipboard.writeText(item.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const openInEditor = async () => {
    if (!item.sampleUrl) return;
    const fileName = item.sampleUrl.split('/').pop() || 'sample.html';
    const ok = await openTemplateSample(item.sampleUrl, fileName);
    if (ok) navigate(prefix || '/');
  };

  return (
    <div className="tpl-detail">
      <button
        onClick={onBack}
        className="group hds-btn px-4 py-2 text-xs inline-flex items-center gap-1.5"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-300 group-hover:-translate-x-1"
          aria-hidden="true"
        >
          <path d="M19 12H5M11 19l-7-7 7-7" />
        </svg>
        {t('detail.back')}
      </button>

      {/* Two-column split: preview sticks on the left, meta flows on the right. */}
      <div className="mt-6 grid lg:grid-cols-2 gap-8 items-start">
        {/* Left: sticky preview */}
        <div className="lg:sticky lg:top-24">
          {item.sampleUrl ? (
            <SampleThumb url={item.sampleUrl} kind={item.kind} />
          ) : (
            <div className="w-full aspect-[16/9] rounded-2xl border border-dashed border-[var(--rule)] bg-white/[0.03] grid place-items-center">
              <span className="text-[13px] text-[var(--tertiary-label)]">{t('detail.previewPlaceholder')}</span>
            </div>
          )}
          {item.sampleUrl && (
            <div className="mt-4 flex items-center gap-2.5 flex-wrap">
              <button onClick={openInEditor} disabled={loading} className="hds-btn-primary px-5 py-2 text-xs rounded-full disabled:opacity-50">
                {t('detail.openInEditor')}
              </button>
              <a href={item.sampleUrl} download className="hds-btn px-4 py-2 text-xs">{t('detail.download')}</a>
            </div>
          )}
          {error && (
            <div id="hds-open-error" className="mt-3 text-xs text-[var(--system-red,#ef4444)]">{error}</div>
          )}
        </div>

        {/* Right: flowing meta */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-[var(--label)]">
              {t(`items.${item.id}.title`)}
            </h1>
            <KindBadge kind={item.kind} />
          </div>
          <p className="mt-3 text-[15px] text-[var(--secondary-label)] leading-relaxed">{t(`items.${item.id}.desc`)}</p>

          <section className="mt-8">
            <div className="flex items-center justify-between mb-3 gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--tertiary-label)]">{t('detail.promptTitle')}</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPromptOpen((v) => !v)}
                  disabled={!item.prompt}
                  aria-expanded={promptOpen}
                  className="hds-btn px-3 py-1.5 text-xs inline-flex items-center gap-1.5 disabled:opacity-40"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transform: promptOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
                  >
                    <path d="M5 7.5l5 5 5-5" />
                  </svg>
                  {promptOpen ? t('detail.collapse') : t('detail.expand')}
                </button>
                <button
                  onClick={copy}
                  disabled={!item.prompt}
                  className="hds-btn-primary px-4 py-1.5 text-xs rounded-full disabled:opacity-40"
                >
                  {copied ? t('detail.copied') : t('detail.copyPrompt')}
                </button>
              </div>
            </div>
            {promptOpen ? (
              <pre className="rounded-2xl border border-[var(--separator)] bg-white/[0.025] p-4 text-[13px] text-[var(--secondary-label)] leading-relaxed whitespace-pre-wrap break-words">
                {item.prompt || t('detail.todo')}
              </pre>
            ) : (
              <button
                onClick={() => item.prompt && setPromptOpen(true)}
                disabled={!item.prompt}
                className="w-full text-left rounded-2xl border border-[var(--separator)] bg-white/[0.025] p-4 text-[13px] text-[var(--tertiary-label)] leading-relaxed disabled:opacity-60"
              >
                {item.prompt ? t('detail.promptHint') : t('detail.todo')}
              </button>
            )}
          </section>

          {/* Usage */}
          <section className="mt-6 rounded-2xl border border-[var(--separator)] bg-white/[0.025] p-5">
            <h2 className="text-[13px] font-semibold text-[var(--label)] mb-1.5">{t('detail.usageTitle')}</h2>
            <p className="text-[13px] text-[var(--secondary-label)] leading-relaxed">{t('detail.usage')}</p>
          </section>

          {item.credit && (
            <p className="mt-6 text-xs text-[var(--tertiary-label)]">
              {t('detail.creditPrefix')}{' '}
              <a
                href={item.credit.href}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--system-blue)] hover:underline"
              >
                {item.credit.name}
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
