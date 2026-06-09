import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLocalePrefix } from '../hooks/useGuideNav.js';
import { useOpenDeck } from '../fs/useOpenDeck.js';
import { SiteHeader } from '../components/SiteHeader.js';
import { SiteFluidBackdrop } from '../components/SiteFluidBackdrop.js';
import { TEMPLATES, findTemplate, type TemplateItem } from '../data/templates.js';

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

  return (
    <div
      ref={ref}
      className="w-full rounded-xl overflow-hidden"
      style={{ aspectRatio: '16 / 9', position: 'relative', background: '#f5f4ed', boxShadow: 'inset 0 0 0 1px rgba(20,20,19,0.08)' }}
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId ? findTemplate(selectedId) : undefined;

  return (
    <div className="hds-cinema relative w-full min-h-screen overflow-x-hidden">
      <SiteFluidBackdrop />
      <div className="relative z-10">
        <SiteHeader alwaysScrolled />

        <main className="max-w-6xl mx-auto px-6 pt-16 sm:pt-24 pb-20">
          {!selected ? (
            <>
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
                {TEMPLATES.map((item) => (
                  <TemplateCard key={item.id} item={item} onOpen={() => setSelectedId(item.id)} />
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
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-[var(--separator)] text-[var(--secondary-label)]">
      {kind === 'deck' ? t('card.deck') : t('card.doc')}
    </span>
  );
}

function TemplateCard({ item, onOpen }: { item: TemplateItem; onOpen: () => void }) {
  const { t } = useTranslation('templates');
  return (
    <button
      onClick={onOpen}
      className="hds-glass-card p-5 text-left flex flex-col gap-3 transition-transform hover:-translate-y-0.5"
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
      <span className="text-xs text-[var(--system-blue)] mt-auto">{t('card.viewDetail')} →</span>
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
    <div className="max-w-3xl">
      <button onClick={onBack} className="hds-btn px-4 py-2 text-xs">← {t('detail.back')}</button>

      <div className="mt-6 flex items-center gap-3">
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-[var(--label)]">
          {t(`items.${item.id}.title`)}
        </h1>
        <KindBadge kind={item.kind} />
      </div>
      <p className="mt-3 text-[15px] text-[var(--secondary-label)] leading-relaxed">{t(`items.${item.id}.desc`)}</p>

      {item.sampleUrl && (
        <div className="mt-5 flex items-center gap-2.5 flex-wrap">
          <button onClick={openInEditor} disabled={loading} className="hds-btn-primary px-5 py-2 text-xs rounded-full disabled:opacity-50">
            {t('detail.openInEditor')}
          </button>
          <a href={item.sampleUrl} download className="hds-btn px-4 py-2 text-xs">{t('detail.download')}</a>
        </div>
      )}

      {error && (
        <div id="hds-open-error" className="mt-3 text-xs text-[var(--system-red,#ef4444)]">{error}</div>
      )}

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--tertiary-label)] mb-3">{t('detail.previewTitle')}</h2>
        {item.sampleUrl ? (
          <SampleThumb url={item.sampleUrl} kind={item.kind} />
        ) : (
          <div className="w-full aspect-[16/9] rounded-2xl border border-dashed border-[var(--rule)] bg-white/[0.03] grid place-items-center">
            <span className="text-[13px] text-[var(--tertiary-label)]">{t('detail.previewPlaceholder')}</span>
          </div>
        )}
      </section>

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
      <section className="mt-8 rounded-2xl border border-[var(--separator)] bg-white/[0.025] p-5">
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
  );
}
