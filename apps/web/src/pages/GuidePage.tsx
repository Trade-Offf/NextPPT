import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDeckStore } from '../store/deckStore.js';
import { useOpenDeck, FILE_API_SUPPORTED } from '../fs/useOpenDeck.js';
import { gsap, useGSAP, revealOnScroll } from '../lib/gsap.js';
import { useGuideNav, useLocalePrefix } from '../hooks/useGuideNav.js';
import { SiteHeader } from '../components/SiteHeader.js';
import { OpenDeckErrorAlert } from '../components/OpenDeckErrorAlert.js';
import type { GuideTab } from '../data/guide.js';

const TABS: readonly GuideTab[] = ['generate', 'edit', 'export'];

function tabFromParam(param: string | undefined): GuideTab | null {
  if (!param) return null;
  return (TABS as readonly string[]).includes(param) ? (param as GuideTab) : null;
}

interface Step { title: string; desc: string }

export function GuidePage() {
  const { t } = useTranslation('guide');
  const { t: tPrompt } = useTranslation('prompt');
  const { closeGuide } = useGuideNav();
  const navigate = useNavigate();
  const prefix = useLocalePrefix();
  const { tab: tabParam } = useParams<{ tab: string }>();
  const activeTab = tabFromParam(tabParam);

  const hasDeck = useDeckStore((s) => s.slides.length > 0);
  const { error, handlePickFile, handlePickFolder } = useOpenDeck();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  const flowSteps = t('flow.steps', { returnObjects: true }) as Step[];
  const manualSteps = t('generate.steps', { returnObjects: true, topic: tPrompt('topic') }) as Step[];
  const htmlDeckAbilities = t('edit.htmlDeck.abilities', { returnObjects: true }) as Step[];
  const pptEditorAbilities = t('edit.pptEditor.abilities', { returnObjects: true }) as Step[];
  const htmlExportNotes = t('export.htmlExport.notes', { returnObjects: true }) as string[];
  const pptExportNotes = t('export.pptExport.notes', { returnObjects: true }) as string[];
  const promptText = tPrompt('generate', { topic: tPrompt('topic') });

  // Esc returns to the page the reader came from.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeGuide(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeGuide]);

  // Scroll to the requested tab whenever the path param changes.
  useEffect(() => {
    if (!activeTab) return;
    document.getElementById(`guide-${activeTab}`)?.scrollIntoView({ block: 'start' });
  }, [activeTab]);

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
      {/* Sticky header — shared SiteHeader (guide variant) */}
      <SiteHeader
        alwaysScrolled
        trailing={
          hasDeck ? (
            <button onClick={closeGuide} className="hds-btn-primary px-3.5 py-1.5 text-xs">{t('header.backToEdit')}</button>
          ) : null
        }
      />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 pb-20">
        {/* ── 3-step rhythm strip ─────────────────────────────── */}
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

        <div className="flex flex-col gap-6 mt-10">

          <section id="guide-generate" className="hds-guide-story reveal-section scroll-mt-24">
            <div className="hds-guide-illus">
              <picture>
                <source srcSet="/guide-step-generate.webp" type="image/webp" />
                <img src="/guide-step-generate.png" alt={t('generate.title')} width={1200} height={675} loading="lazy" />
              </picture>
            </div>
            <div className="hds-guide-story-body">
              <span className="hds-guide-step-tag">{t('generate.title')}</span>
              <p className="text-sm text-[var(--secondary-label)] leading-relaxed mt-2 mb-3">{t('generate.intro')}</p>
              <p className="hds-term mb-5">{t('generate.promptWhat')}</p>

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
                <p className="text-xs text-[var(--tertiary-label)] leading-relaxed">{t('generate.promptHint')}</p>
              )}

              <div className="hds-guide-action">
                <span className="text-xs text-[var(--tertiary-label)]">{t('generate.actionLabel')}</span>
                <OpenButton label={t('generate.openGenerated')} />
              </div>
            </div>
          </section>

          <section id="guide-edit" className="hds-guide-story is-reverse reveal-section scroll-mt-24">
            <div className="hds-guide-illus-col">
              <div className="hds-guide-illus">
                <picture>
                  <source srcSet="/guide-step-edit.webp" type="image/webp" />
                  <img src="/guide-step-edit.png" alt={t('edit.title')} width={1200} height={675} loading="lazy" />
                </picture>
              </div>
              {/* Looping micro-demo: a cursor clicking a text line that lights up. */}
              <div className="hds-mini-demo" aria-hidden="true">
                <div className="hds-mini-slide">
                  <span className="hds-mini-line is-title" />
                  <span className="hds-mini-line" />
                  <span className="hds-mini-line is-short" />
                  <svg className="hds-mini-cursor" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 7-6 2-2 6-6-15z" /></svg>
                </div>
              </div>
            </div>
            <div className="hds-guide-story-body">
              <span className="hds-guide-step-tag">{t('edit.title')}</span>
              <p className="text-sm text-[var(--secondary-label)] leading-relaxed mt-2 mb-5">{t('edit.intro')}</p>

              {/* HTML 演示台 */}
              <div className="hds-guide-editor-card">
                <div className="hds-guide-editor-head">
                  <h3 className="hds-guide-editor-name">{t('edit.htmlDeck.name')}</h3>
                  <span className="hds-guide-editor-pill">{t('edit.htmlDeck.pill')}</span>
                </div>
                <p className="hds-guide-editor-desc">{t('edit.htmlDeck.desc')}</p>
                <ul className="hds-guide-abilities">
                  {htmlDeckAbilities.map((a) => (
                    <li key={a.title}>
                      <svg className="hds-ability-tick" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.2 3.2L13 4.5" /></svg>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[var(--label)] leading-tight">{a.title}</p>
                        <p className="text-xs text-[var(--secondary-label)] leading-relaxed mt-0.5">{a.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <button onClick={() => navigate(`${prefix}/html`)} className="hds-btn-primary px-3.5 py-1.5 text-xs mt-3">{t('edit.htmlDeck.cta')}</button>
              </div>

              {/* PPT 编辑器 */}
              <div className="hds-guide-editor-card">
                <div className="hds-guide-editor-head">
                  <h3 className="hds-guide-editor-name">{t('edit.pptEditor.name')}</h3>
                </div>
                <p className="hds-guide-editor-desc">{t('edit.pptEditor.desc')}</p>
                <ul className="hds-guide-abilities">
                  {pptEditorAbilities.map((a) => (
                    <li key={a.title}>
                      <svg className="hds-ability-tick" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.2 3.2L13 4.5" /></svg>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[var(--label)] leading-tight">{a.title}</p>
                        <p className="text-xs text-[var(--secondary-label)] leading-relaxed mt-0.5">{a.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3">
                  {hasDeck ? (
                    <button onClick={closeGuide} className="hds-btn-primary px-3.5 py-1.5 text-xs">{t('header.backToEdit')}</button>
                  ) : (
                    <OpenButton label={t('edit.pptEditor.cta')} />
                  )}
                </div>
              </div>
            </div>
          </section>

          <section id="guide-export" className="hds-guide-story reveal-section scroll-mt-24">
            <div className="hds-guide-illus">
              <picture>
                <source srcSet="/guide-step-export.webp" type="image/webp" />
                <img src="/guide-step-export.png" alt={t('export.title')} width={1200} height={675} loading="lazy" />
              </picture>
            </div>
            <div className="hds-guide-story-body">
              <span className="hds-guide-step-tag">{t('export.title')}</span>
              <p className="text-sm text-[var(--secondary-label)] leading-relaxed mt-2 mb-5">{t('export.intro')}</p>

              {/* HTML 演示台导出 */}
              <div className="hds-guide-editor-card">
                <div className="hds-guide-editor-head">
                  <h3 className="hds-guide-editor-name">{t('export.htmlExport.name')}</h3>
                </div>
                <ul className="hds-steps">
                  {htmlExportNotes.map((note, i) => (
                    <li key={note} className="hds-step">
                      <span className="hds-step-num">{i + 1}</span>
                      <p className="text-sm text-[var(--label)] leading-relaxed min-w-0">{note}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* PPT 编辑器导出 */}
              <div className="hds-guide-editor-card">
                <div className="hds-guide-editor-head">
                  <h3 className="hds-guide-editor-name">{t('export.pptExport.name')}</h3>
                </div>
                <ul className="hds-steps">
                  {pptExportNotes.map((note, i) => (
                    <li key={note} className="hds-step">
                      <span className="hds-step-num">{i + 1}</span>
                      <p className="text-sm text-[var(--label)] leading-relaxed min-w-0">{note}</p>
                    </li>
                  ))}
                </ul>
              </div>

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
          </section>
        </div>

        {error && (
          <OpenDeckErrorAlert className="mt-8 text-xs" error={error} />
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
