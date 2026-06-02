import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { useDeckStore } from '../store/deckStore.js';
import { useOpenDeck, FILE_API_SUPPORTED } from '../fs/useOpenDeck.js';
import { gsap, useGSAP, revealOnScroll } from '../lib/gsap.js';
import { useGuideNav } from '../hooks/useGuideNav.js';
import type { GuideTab } from '../data/guide.js';

const ANCHORS: readonly GuideTab[] = ['generate', 'existing', 'export'];

function anchorFromHash(hash: string): GuideTab | null {
  const h = hash.replace('#', '');
  return (ANCHORS as readonly string[]).includes(h) ? (h as GuideTab) : null;
}

interface FlowStep { title: string; desc: string }
interface Mistake { label: string; good: string; bad: string }

export function GuidePage() {
  const { t } = useTranslation('guide');
  const { t: tPrompt } = useTranslation('prompt');
  const { closeGuide } = useGuideNav();
  const { hash } = useLocation();
  const hashAnchor = anchorFromHash(hash);

  const hasDeck = useDeckStore((s) => s.slides.length > 0);
  const { error, handlePickFile, handlePickFolder } = useOpenDeck();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(hashAnchor ?? 'generate');
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  const flowSteps = t('flow.steps', { returnObjects: true }) as FlowStep[];
  const manualSteps = t('generate.steps', { returnObjects: true, topic: tPrompt('topic') }) as FlowStep[];
  const selfCheck = t('existing.selfCheck', { returnObjects: true }) as string[];
  const mistakes = t('existing.mistakes', { returnObjects: true }) as Mistake[];
  const exportNotes = t('export.notes', { returnObjects: true }) as string[];
  const promptText = tPrompt('generate', { topic: tPrompt('topic') });

  // Esc returns to the page the reader came from.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeGuide(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeGuide]);

  // Open + scroll to the requested anchor whenever the hash changes.
  useEffect(() => {
    if (!hashAnchor) return;
    setOpenId(hashAnchor);
    document.getElementById(`guide-${hashAnchor}`)?.scrollIntoView({ block: 'start' });
  }, [hashAnchor]);

  // Entrance animation + per-section scroll reveals. The guide scrolls inside
  // a fixed container, so ScrollTrigger must use scrollRef as its scroller.
  useGSAP(
    () => {
      const scroller = scrollRef.current;
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.guide-intro', { autoAlpha: 0, y: 18, duration: 0.6, ease: 'power3.out' });
        gsap.from('.flow-step', { autoAlpha: 0, y: 16, duration: 0.6, ease: 'power3.out', stagger: 0.08, delay: 0.05 });
        gsap.utils.toArray<HTMLElement>('.reveal-section').forEach((el) => {
          revealOnScroll(el, { scroller, start: 'top 85%', y: 24 });
        });
      });
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(['.guide-intro', '.flow-step', '.reveal-section'], { autoAlpha: 1, y: 0 });
      });
    },
    { scope: scrollRef },
  );

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = promptText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  // Open a deck right here, then drop the reader into the editor (read → act).
  const openInPlace = async () => {
    const before = useDeckStore.getState().slides.length;
    if (FILE_API_SUPPORTED) await handlePickFile();
    else await handlePickFolder();
    if (before === 0 && useDeckStore.getState().slides.length > 0) closeGuide();
  };

  const OpenButton = ({ label, variant = 'primary' }: { label: string; variant?: 'primary' | 'plain' }) => (
    <button
      onClick={openInPlace}
      className={`${variant === 'primary' ? 'hds-btn-primary' : 'hds-btn'} px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5`}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M2 5.5A1.5 1.5 0 013.5 4h3l1.5 1.5h4.5A1.5 1.5 0 0114 7v4.5A1.5 1.5 0 0112.5 13h-9A1.5 1.5 0 012 11.5v-6z" /></svg>
      {label}
    </button>
  );

  return (
    <div ref={scrollRef} className="hds-guide-page hds-cinema fixed inset-0 z-[60] overflow-y-auto">
      {/* Sticky header */}
      <header className="hds-guide-header sticky top-0 z-10">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-8">
          <div className="h-14 flex items-center gap-2.5">
            <button onClick={closeGuide} className="hds-btn px-2 py-1.5 text-sm flex items-center" title={t('header.back')} aria-label={t('header.back')}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M11.5 5L6.5 10l5 5" /></svg>
            </button>
            <button onClick={closeGuide} className="flex items-center gap-2 group transition-opacity hover:opacity-80" title={t('header.backHome')}>
              <img src="/brand-n.png" alt="" className="hds-emblem w-6 h-6" />
              <span className="text-sm font-bold tracking-tight text-[var(--label)]">NextPPT</span>
            </button>
            <span className="hidden sm:inline text-[var(--tertiary-label)]">·</span>
            <h1 className="hidden sm:block text-sm font-medium text-[var(--secondary-label)]">{t('header.title')}</h1>
            <div className="ml-auto">
              {hasDeck ? (
                <button onClick={closeGuide} className="hds-btn-primary px-3.5 py-1.5 text-xs">{t('header.backToEdit')}</button>
              ) : (
                <OpenButton label={t('header.openFile')} />
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-6 sm:px-8 pb-20">
        {/* ── 30-second overview ───────────────────────────────── */}
        <section className="pt-9 pb-2 guide-intro">
          <h2 className="sr-only">{t('flow.eyebrow')}</h2>
          <p className="hds-guide-eyebrow">{t('flow.eyebrow')}</p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {flowSteps.map((f, i) => (
              <div key={f.title} className="hds-guide-flow-step flow-step">
                <span className="hds-step-num">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--label)] leading-tight">{f.title}</p>
                  <p className="text-xs text-[var(--secondary-label)] leading-relaxed mt-1">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-4 mt-8">
          {/* ── Scenario 1: generate ───────────────────────────── */}
          <div id="guide-generate" className={`hds-guide-section hds-acc reveal-section scroll-mt-28 ${openId === 'generate' ? 'is-open' : ''}`}>
            <button type="button" className="hds-acc-head" onClick={() => toggle('generate')} aria-expanded={openId === 'generate'}>
              <span>{t('generate.title')}</span>
              <svg className="hds-acc-chev" width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l4 4 4-4" /></svg>
            </button>
            {openId === 'generate' && (
            <div className="hds-acc-body">
            <p className="text-sm text-[var(--secondary-label)] leading-relaxed mb-6">
              <Trans t={t} i18nKey="generate.intro" components={{ strong: <strong className="text-[var(--label)]" /> }} />
            </p>

            <ol className="hds-steps mb-6">
              {manualSteps.map((step, i) => (
                <li key={step.title} className="hds-step">
                  <span className="hds-step-num">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--label)] leading-tight">{step.title}</p>
                    <p className="text-xs text-[var(--secondary-label)] leading-relaxed mt-0.5">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="hds-inspector-label" style={{ padding: 0 }}>{t('generate.promptLabel')}</span>
              <div className="flex items-center gap-2">
                <button onClick={copyPrompt} className={`hds-copy-btn ${copied ? 'is-copied' : ''}`}>
                  {copied ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.2 3.2L13 4.5" /></svg>
                      {t('generate.copied')}
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="5" y="5" width="9" height="9" rx="1.5" /><path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" strokeLinecap="round" /></svg>
                      {t('generate.copy')}
                    </>
                  )}
                </button>
                <button onClick={() => setPromptOpen((v) => !v)} className="hds-copy-btn" aria-expanded={promptOpen}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ transform: promptOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M4 6l4 4 4-4" /></svg>
                  {promptOpen ? t('generate.collapse') : t('generate.expand')}
                </button>
              </div>
            </div>
            {promptOpen ? (
              <pre className="hds-code-block" style={{ maxHeight: 'none' }}><code>{promptText}</code></pre>
            ) : (
              <p className="text-xs text-[var(--tertiary-label)] leading-relaxed">
                {t('generate.promptHint')}
              </p>
            )}

            <div className="hds-guide-action">
              <span className="text-xs text-[var(--tertiary-label)]">{t('generate.actionLabel')}</span>
              <OpenButton label={t('generate.openGenerated')} />
            </div>
            </div>
            )}
          </div>

          {/* ── Scenario 2: existing HTML ──────────────────────── */}
          <div id="guide-existing" className={`hds-guide-section hds-acc reveal-section scroll-mt-28 ${openId === 'existing' ? 'is-open' : ''}`}>
            <button type="button" className="hds-acc-head" onClick={() => toggle('existing')} aria-expanded={openId === 'existing'}>
              <span>{t('existing.title')}</span>
              <svg className="hds-acc-chev" width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l4 4 4-4" /></svg>
            </button>
            {openId === 'existing' && (
            <div className="hds-acc-body">
            <p className="text-sm text-[var(--secondary-label)] leading-relaxed mb-6">
              {t('existing.intro')}
            </p>

            <span className="hds-inspector-label" style={{ padding: 0 }}>{t('existing.selfCheckLabel')}</span>
            <ul className="mt-2 mb-8 flex flex-col gap-2.5">
              {selfCheck.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--label)] leading-relaxed">
                  <svg className="mt-0.5 shrink-0 text-[var(--system-blue)]" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.2 3.2L13 4.5" /></svg>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <span className="hds-inspector-label" style={{ padding: 0 }}>{t('existing.mistakesLabel')}</span>
            <div className="mt-2 grid sm:grid-cols-2 gap-2.5">
              {mistakes.map((m) => (
                <div key={m.label} className="hds-inspector-section p-3.5">
                  <p className="text-[11px] font-semibold text-[var(--tertiary-label)] mb-2">{m.label}</p>
                  <p className="text-[12px] text-emerald-400 flex items-start gap-1.5 leading-relaxed">
                    <span className="shrink-0">✅</span><span className="font-mono break-all">{m.good}</span>
                  </p>
                  <p className="text-[12px] text-red-500 flex items-start gap-1.5 leading-relaxed mt-1.5">
                    <span className="shrink-0">❌</span><span className="break-all">{m.bad}</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="hds-guide-action">
              <span className="text-xs text-[var(--tertiary-label)]">{t('existing.actionLabel')}</span>
              <OpenButton label={t('existing.openMine')} />
            </div>
            </div>
            )}
          </div>

          {/* ── Scenario 3: export ─────────────────────────────── */}
          <div id="guide-export" className={`hds-guide-section hds-acc reveal-section scroll-mt-28 ${openId === 'export' ? 'is-open' : ''}`}>
            <button type="button" className="hds-acc-head" onClick={() => toggle('export')} aria-expanded={openId === 'export'}>
              <span>{t('export.title')}</span>
              <svg className="hds-acc-chev" width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l4 4 4-4" /></svg>
            </button>
            {openId === 'export' && (
            <div className="hds-acc-body">
            <p className="text-sm text-[var(--secondary-label)] leading-relaxed mb-6">
              {t('export.intro')}
            </p>
            <ul className="flex flex-col gap-3.5">
              {exportNotes.map((note, i) => (
                <li key={note} className="hds-step">
                  <span className="hds-step-num">{i + 1}</span>
                  <p className="text-sm text-[var(--label)] leading-relaxed min-w-0">{note}</p>
                </li>
              ))}
            </ul>

            <div className="hds-guide-action">
              {hasDeck ? (
                <>
                  <span className="text-xs text-[var(--tertiary-label)]">{t('export.actionHasDeck')}</span>
                  <button onClick={closeGuide} className="hds-btn-primary px-3.5 py-1.5 text-xs">{t('export.backToExport')}</button>
                </>
              ) : (
                <>
                  <span className="text-xs text-[var(--tertiary-label)]">{t('export.actionNoDeck')}</span>
                  <OpenButton label={t('export.openFile')} />
                </>
              )}
            </div>
            </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-8 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 leading-relaxed">
            {error}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-[var(--separator)] flex items-center justify-between text-xs text-[var(--tertiary-label)]">
          <button onClick={closeGuide} className="hover:text-[var(--system-blue)] transition-colors">{t('footer.backHome')}</button>
          <span>{t('footer.local')}</span>
        </footer>
      </div>
    </div>
  );
}
