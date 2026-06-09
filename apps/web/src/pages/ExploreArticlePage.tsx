import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useLocalePrefix } from '../hooks/useGuideNav.js';
import { SiteHeader } from '../components/SiteHeader.js';
import { SiteFluidBackdrop } from '../components/SiteFluidBackdrop.js';
import { findArticle } from '../data/explore.js';

export function ExploreArticlePage() {
  const { t } = useTranslation('explore');
  const navigate = useNavigate();
  const prefix = useLocalePrefix();
  const { slug } = useParams<{ slug: string }>();
  const article = findArticle(slug);

  const [copied, setCopied] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  if (!article) return <Navigate to={`${prefix}/explore`} replace />;

  const howSteps = t('article.how.steps', { returnObjects: true }) as string[];
  const valueItems = t('article.value.items', { returnObjects: true }) as string[];
  const sceneItems = t('article.scenes.items', { returnObjects: true }) as string[];
  const promptText = t('article.prompt.body');

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

  return (
    <div className="hds-cinema relative w-full min-h-screen overflow-x-hidden">
      <SiteFluidBackdrop />
      <div className="relative z-10">
        <SiteHeader alwaysScrolled />

        <article className="max-w-[760px] mx-auto px-6 pt-16 sm:pt-24 pb-24">
          <button
            onClick={() => navigate(`${prefix}/explore`)}
            className="hds-btn px-3.5 py-1.5 text-xs"
          >
            ← {t('article.back')}
          </button>

          {/* Masthead */}
          <header className="mt-6">
            <p className="hds-fig-label">{t('hero.eyebrow')}</p>
            <h1 className="mt-3 text-3xl lg:text-[2.4rem] font-bold tracking-tight text-[var(--label)] leading-tight">
              {t(`items.${article.slug}.title`)}
            </h1>
            <p className="mt-4 text-[15px] text-[var(--secondary-label)] leading-relaxed">
              {t('article.lead')}
            </p>
          </header>

          {/* Cover */}
          <figure className="mt-8">
            <div
              className="rounded-2xl overflow-hidden"
              style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.06)' }}
            >
              <img src={article.cover} alt="" className="block w-full" />
            </div>
            <figcaption className="mt-3 text-xs text-[var(--tertiary-label)] leading-relaxed">
              {t('article.cover')}
            </figcaption>
          </figure>

          {/* How */}
          <section className="mt-12">
            <h2 className="text-xl font-semibold text-[var(--label)]">{t('article.how.title')}</h2>
            <p className="mt-3 text-sm text-[var(--secondary-label)]">{t('article.how.intro')}</p>
            <ol className="mt-4 flex flex-col gap-2.5">
              {howSteps.map((step, i) => (
                <li key={step} className="flex gap-3 items-start">
                  <span className="hds-step-num shrink-0">{i + 1}</span>
                  <p className="text-sm text-[var(--label)] leading-relaxed min-w-0 pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Flow diagram */}
          <section className="mt-12">
            <h2 className="text-xl font-semibold text-[var(--label)]">{t('article.flow.title')}</h2>
            <div
              className="mt-4 rounded-2xl p-5 sm:p-7"
              style={{ background: 'rgba(255,255,255,0.025)', boxShadow: 'inset 0 0 0 1px var(--separator)' }}
            >
              <FlowDiagram />
            </div>
            <p className="mt-3 text-xs text-[var(--tertiary-label)] leading-relaxed">{t('article.flow.caption')}</p>
          </section>

          {/* Value */}
          <section className="mt-12">
            <h2 className="text-xl font-semibold text-[var(--label)]">{t('article.value.title')}</h2>
            <p className="mt-3 text-sm text-[var(--secondary-label)]">{t('article.value.intro')}</p>
            <ul className="mt-4 flex flex-col gap-2">
              {valueItems.map((item) => (
                <li key={item} className="relative pl-5 text-sm text-[var(--label)] leading-relaxed">
                  <span className="absolute left-0 text-[var(--system-blue)]">—</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Scenes */}
          <section className="mt-12">
            <h2 className="text-xl font-semibold text-[var(--label)]">{t('article.scenes.title')}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {sceneItems.map((item) => (
                <span
                  key={item}
                  className="text-[13px] text-[var(--secondary-label)] px-3 py-1.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.04)', boxShadow: 'inset 0 0 0 1px var(--separator)' }}
                >
                  {item}
                </span>
              ))}
            </div>
          </section>

          {/* Future */}
          <section className="mt-12">
            <h2 className="text-xl font-semibold text-[var(--label)]">{t('article.future.title')}</h2>
            <p className="mt-3 text-sm text-[var(--secondary-label)] leading-relaxed">{t('article.future.body')}</p>
            <blockquote
              className="mt-4 pl-4 text-[15px] text-[var(--label)] leading-relaxed"
              style={{ borderLeft: '3px solid var(--system-blue)' }}
            >
              {t('article.future.quote')}
            </blockquote>
          </section>

          {/* Prompt */}
          <section className="mt-12">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-[var(--label)]">{t('article.prompt.title')}</h2>
              <div className="flex items-center gap-2">
                <button onClick={copyPrompt} className={`hds-copy-btn ${copied ? 'is-copied' : ''}`}>
                  {copied ? t('article.prompt.copied') : t('article.prompt.copy')}
                </button>
                <button onClick={() => setPromptOpen((v) => !v)} className="hds-copy-btn" aria-expanded={promptOpen}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ transform: promptOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M4 6l4 4 4-4" /></svg>
                  {promptOpen ? t('article.prompt.collapse') : t('article.prompt.expand')}
                </button>
              </div>
            </div>
            {promptOpen ? (
              <pre className="hds-code-block mt-3" style={{ maxHeight: 'none' }}><code>{promptText}</code></pre>
            ) : (
              <p className="mt-3 text-xs text-[var(--tertiary-label)] leading-relaxed">{t('article.prompt.hint')}</p>
            )}
          </section>

          {/* Download */}
          {article.drawioUrl && (
            <div className="mt-8">
              <a href={article.drawioUrl} download className="hds-btn-primary px-5 py-2 text-xs rounded-full inline-flex items-center gap-2">
                ↓ {t('article.download')}
              </a>
            </div>
          )}

          {/* Summary */}
          <section
            className="mt-12 rounded-2xl p-6"
            style={{ background: 'rgba(56,132,255,0.06)', boxShadow: 'inset 0 0 0 1px var(--separator)' }}
          >
            <p className="hds-fig-label">{t('article.summary.title')}</p>
            <p className="mt-2 text-[17px] text-[var(--label)] leading-relaxed font-medium">{t('article.summary.body')}</p>
          </section>

          <footer className="mt-10 pt-6 border-t border-[var(--separator)] flex items-center justify-between text-xs text-[var(--tertiary-label)]">
            <button onClick={() => navigate(`${prefix}/explore`)} className="hover:text-[var(--system-blue)] transition-colors">
              ← {t('article.back')}
            </button>
            <span>{t('article.source')}</span>
          </footer>
        </article>
      </div>
    </div>
  );
}

/**
 * Hand-authored inline SVG flowchart (no mermaid dependency). Node labels are
 * pulled from i18n so it stays bilingual; colors reference the site's CSS vars
 * so it reads cleanly on the dark cinema theme.
 */
function FlowDiagram() {
  const { t } = useTranslation('explore');
  const n = (k: string) => t(`article.flow.nodes.${k}`);

  const nodes = [
    { x: 16, title: n('content'), sub: n('contentSub') },
    { x: 260, title: n('ai'), sub: n('aiSub') },
    { x: 504, title: n('file'), sub: n('fileSub') },
    { x: 748, title: n('board'), sub: n('boardSub'), accent: true },
  ];
  const W = 196;
  const H = 78;
  const Y = 22;
  const outcomes = [n('editable'), n('collab'), n('reuse')];

  return (
    <svg viewBox="0 0 960 250" width="100%" role="img" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <marker id="exp-arrow" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L6,3 L0,6 Z" style={{ fill: 'var(--tertiary-label)' }} />
        </marker>
      </defs>

      {/* pipeline arrows */}
      {[0, 1, 2].map((i) => {
        const x1 = nodes[i].x + W;
        const x2 = nodes[i + 1].x;
        return (
          <line
            key={i}
            x1={x1 + 3}
            y1={Y + H / 2}
            x2={x2 - 5}
            y2={Y + H / 2}
            style={{ stroke: 'var(--tertiary-label)', strokeWidth: 2 }}
            markerEnd="url(#exp-arrow)"
          />
        );
      })}

      {/* nodes */}
      {nodes.map((node) => (
        <g key={node.title}>
          <rect
            x={node.x}
            y={Y}
            width={W}
            height={H}
            rx={12}
            style={{
              fill: node.accent ? 'rgba(56,132,255,0.10)' : 'rgba(255,255,255,0.04)',
              stroke: node.accent ? 'var(--system-blue)' : 'var(--separator)',
              strokeWidth: node.accent ? 1.5 : 1,
            }}
          />
          <text x={node.x + W / 2} y={Y + 32} textAnchor="middle" style={{ fill: 'var(--label)', fontSize: 16, fontWeight: 600 }}>
            {node.title}
          </text>
          <text x={node.x + W / 2} y={Y + 54} textAnchor="middle" style={{ fill: 'var(--secondary-label)', fontSize: 12 }}>
            {node.sub}
          </text>
        </g>
      ))}

      {/* connector from board node down to the outcome bar */}
      <line
        x1={nodes[3].x + W / 2}
        y1={Y + H}
        x2={nodes[3].x + W / 2}
        y2={158}
        style={{ stroke: 'var(--tertiary-label)', strokeWidth: 2 }}
        markerEnd="url(#exp-arrow)"
      />

      {/* outcome bar */}
      <rect x={16} y={166} width={928} height={62} rx={14} style={{ fill: 'rgba(56,132,255,0.06)', stroke: 'var(--system-blue)', strokeWidth: 1 }} />
      {outcomes.map((label, i) => {
        const cw = 280;
        const gap = 8;
        const total = cw * 3 + gap * 2;
        const startX = (960 - total) / 2;
        const x = startX + i * (cw + gap);
        return (
          <g key={label}>
            <rect x={x} y={180} width={cw} height={34} rx={17} style={{ fill: 'rgba(255,255,255,0.05)', stroke: 'var(--separator)', strokeWidth: 1 }} />
            <text x={x + cw / 2} y={202} textAnchor="middle" style={{ fill: 'var(--label)', fontSize: 14, fontWeight: 500 }}>
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
