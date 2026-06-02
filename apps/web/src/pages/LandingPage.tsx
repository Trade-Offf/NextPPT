import { useRef } from 'react';
import { useDeckStore } from '../store/deckStore.js';
import { useOpenDeck, DIR_API_SUPPORTED, FILE_API_SUPPORTED, FS_API_SUPPORTED } from '../fs/useOpenDeck.js';
import { gsap, useGSAP, revealOnScroll } from '../lib/gsap.js';
import { SiteHeader } from '../components/SiteHeader.js';
import { EditorPreview } from '../components/EditorPreview.js';
import { SiteFluidBackdrop } from '../components/SiteFluidBackdrop.js';

const PAINS = [
  '没精力从头做 PPT，于是把文档丢给 AI，让它直接生成一份演示。',
  '但 AI 产出的 PPT 往往简陋——越来越多人改用 HTML 网页来承接，更精致、更有设计感。',
  '可一旦想改个字体、调个配色、换句文案，又得回到对话里重新描述，token 哗哗地烧，还要来回等待。',
];

export function LandingPage() {
  const openGuide = useDeckStore((s) => s.openGuide);
  const {
    loading,
    error,
    dragOver,
    setDragOver,
    handlePickFolder,
    handlePickFile,
    handleRecall,
    loadSampleTemplate,
    handleDrop,
  } = useOpenDeck();

  const rootRef = useRef<HTMLDivElement>(null);

  const openPrimary = () => {
    if (DIR_API_SUPPORTED) void handlePickFolder();
    else void handlePickFile();
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
      <SiteHeader onOpen={openPrimary} canOpen={FS_API_SUPPORTED} />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section id="top" className="hds-hero relative px-6 pt-16 sm:pt-24 pb-16">
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h1 className="hero-h1 hds-hero-title hds-display text-[clamp(2.3rem,5.6vw,4rem)]">
            AI 写的 HTML，<br className="hidden sm:block" />秒变<span className="hds-hero-accent"> 可点编辑 </span>的演示稿
          </h1>
          <p className="hero-sub mt-6 text-[15px] sm:text-[17px] text-[var(--secondary-label)] leading-relaxed max-w-xl mx-auto">
            把任意 AI 生成的 HTML 幻灯片拖进来，所见即所得地改字、换图、实时渲染 Mermaid，再一键导出 PPTX / PDF。
          </p>
          <div className="hero-cta mt-9 flex flex-wrap items-center justify-center gap-3">
            {FS_API_SUPPORTED ? (
              <button onClick={openPrimary} disabled={loading} className="hds-btn-primary px-6 py-3 text-sm disabled:opacity-50">
                {loading ? '加载中…' : '打开文件 / 拖到此处'}
              </button>
            ) : (
              <span className="text-sm text-[var(--secondary-label)]">请用 Chrome / Edge 等 Chromium 浏览器打开</span>
            )}
            <button onClick={() => openGuide('generate')} className="hds-btn px-5 py-3 text-sm">看 30 秒使用指南</button>
          </div>
          <p className="hero-support mt-4 text-xs text-[var(--tertiary-label)]">支持文件夹（可读写配套图片）或单个自包含 HTML · 需 Chromium 内核浏览器</p>
        </div>

        <div id="preview" className="hero-preview relative z-10 mt-14 sm:mt-16 scroll-mt-20">
          <EditorPreview />
        </div>
      </section>

      {/* ── Second screen: pain narrative (left) + action hub (right) ── */}
      <section id="start" className="value-section px-6 py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — why this exists */}
          <div>
            <p className="reveal-pain hds-fig-label">为什么需要 NextPPT</p>
            <h2 className="reveal-pain mt-3 text-3xl lg:text-[2.5rem] font-bold tracking-tight text-[var(--label)] leading-tight">
              AI 能生成，却<span className="hds-hero-accent">改不动</span>
            </h2>
            <p className="reveal-pain mt-3 text-[15px] text-[var(--secondary-label)]">那最后一步，交给我们。</p>
            <div className="mt-8 flex flex-col gap-5">
              {PAINS.map((p, i) => (
                <div key={i} className="reveal-pain flex gap-4">
                  <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full border border-[var(--separator)] bg-white/[0.04] grid place-items-center text-[11px] font-mono text-[var(--secondary-label)]">{i + 1}</span>
                  <p className="text-[15px] text-[var(--secondary-label)] leading-relaxed">{p}</p>
                </div>
              ))}
            </div>
            <div className="reveal-pain mt-6 rounded-2xl border border-[var(--separator)] bg-white/[0.025] p-5">
              <p className="text-[15px] text-[var(--label)] leading-relaxed">
                <span className="hds-hero-accent font-semibold">NextPPT</span> 让你把这份 HTML 直接拖进来，在页面上点选就能改字体、配色和内容——所见即所得，<span className="font-medium">不再为改一个字重开一轮 AI 对话</span>。
              </p>
            </div>
          </div>

          {/* Right — action hub */}
          <div className="reveal-start w-full max-w-md lg:justify-self-end">
            <div className="hds-glass-card p-7 sm:p-8">
            {!FS_API_SUPPORTED ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-[var(--secondary-label)] leading-relaxed">
                <p className="font-medium text-[var(--label)] mb-1">当前浏览器不支持本地文件读写</p>
                <p>
                  本功能依赖 File System Access API，目前仅 Chromium 内核浏览器支持。请使用{' '}
                  <a className="underline" href="https://www.google.com/chrome/" target="_blank" rel="noreferrer">Chrome</a>{' '}
                  或 Edge / Brave / Arc 打开本页面。
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
                    {loading ? '加载中…' : '点击选择，或拖拽文件夹 / HTML 到此处'}
                  </span>
                  <span className="text-xs text-[var(--tertiary-label)] leading-relaxed">文件夹模式可读写配套图片；单个 HTML 适合自包含演示稿</span>
                </div>

                <div className="mt-4 flex items-center justify-center gap-2.5">
                  {DIR_API_SUPPORTED && (
                    <button onClick={handlePickFolder} disabled={loading} className="hds-btn-primary px-4 py-2 text-xs disabled:opacity-40">打开文件夹</button>
                  )}
                  {FILE_API_SUPPORTED && (
                    <button onClick={handlePickFile} disabled={loading} className="hds-btn px-4 py-2 text-xs disabled:opacity-40">打开单个 HTML</button>
                  )}
                </div>

                {DIR_API_SUPPORTED && (
                  <button onClick={handleRecall} disabled={loading} className="mt-3 text-xs text-[var(--system-blue)] hover:underline self-center disabled:opacity-40 block mx-auto">
                    重新打开上次的文件夹
                  </button>
                )}

                <div className="mt-5 pt-4 border-t border-[var(--separator)]">
                  <p className="text-xs text-[var(--secondary-label)] text-center mb-3">还没有演示稿？</p>
                  <div className="flex items-center justify-center gap-2.5 flex-wrap">
                    <button onClick={loadSampleTemplate} disabled={loading} className="hds-btn px-3.5 py-1.5 text-xs disabled:opacity-40">用示例模板体验</button>
                    <a href="/sample-deck.html" download="sample-deck.html" className="hds-btn px-3.5 py-1.5 text-xs inline-block">下载示例模板</a>
                    <button onClick={() => openGuide('generate')} className="hds-btn px-3.5 py-1.5 text-xs">让 AI 帮我写</button>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 leading-relaxed">
                <p>{error}</p>
                {/未找到|未在该 HTML/.test(error) && (
                  <p className="mt-2 text-red-300/80">
                    没有现成的演示稿？点上方「用示例模板体验」「下载示例模板」，或{' '}
                    <button onClick={() => openGuide('existing')} className="underline font-medium">查看格式要求</button>
                    {' '}了解如何让 HTML 带上{' '}
                    <code className="font-mono">&lt;section class="slide"&gt;</code>。
                  </p>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--separator)] px-6 py-12">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-sm">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2">
              <img src="/brand-n.png" alt="" className="hds-emblem w-6 h-6" />
              <span className="hds-wordmark">NextPPT</span>
            </div>
            <p className="mt-3 text-xs text-[var(--tertiary-label)] leading-relaxed">下一代 PPT，从 HTML 开始。本地优先，数据不离开你的机器。</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--tertiary-label)] mb-3">产品</p>
            <ul className="space-y-2 text-[var(--secondary-label)]">
              <li><button onClick={() => document.getElementById('preview')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-[var(--label)]">效果预览</button></li>
              <li><button onClick={() => document.getElementById('start')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-[var(--label)]">开始使用</button></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--tertiary-label)] mb-3">资源</p>
            <ul className="space-y-2 text-[var(--secondary-label)]">
              <li><button onClick={() => openGuide('generate')} className="hover:text-[var(--label)]">使用指南</button></li>
              <li><a href="/sample-deck.html" download className="hover:text-[var(--label)]">示例模板</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--tertiary-label)] mb-3">关于</p>
            <ul className="space-y-2 text-[var(--secondary-label)]">
              <li><span>本地优先</span></li>
              <li><span>无需登录</span></li>
            </ul>
          </div>
        </div>
        <p className="max-w-5xl mx-auto mt-10 text-xs text-[var(--tertiary-label)]">© {new Date().getFullYear()} NextPPT</p>
      </footer>
      </div>
    </div>
  );
}
