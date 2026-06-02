import { useRef } from 'react';
import { useDeckStore } from '../store/deckStore.js';
import { useOpenDeck, DIR_API_SUPPORTED, FILE_API_SUPPORTED, FS_API_SUPPORTED } from '../fs/useOpenDeck.js';
import { gsap, useGSAP, revealOnScroll } from '../lib/gsap.js';

const PILLS = ['点选即改字', 'Mermaid 实时渲染', '一键导出 PPTX · PDF', '本地优先'];

const FEATURES = [
  { k: '01', title: '所见即所得', desc: '直接在画布上点选标题、正文、图片就能改，不碰一行代码。' },
  { k: '02', title: 'Mermaid 实时渲染', desc: '流程图、时序图边写边看，演示稿里也能放代码图示。' },
  { k: '03', title: '一键导出', desc: '等字体与图渲染完再截图，导出清晰的 PPTX / PDF 可直接投影。' },
  { k: '04', title: '本地优先', desc: '全程在你的浏览器里处理，文件不上传、数据不离开本机。' },
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

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.7 } });
        tl.from('.hero-brand', { autoAlpha: 0, y: 18 })
          .from('.hero-title', { autoAlpha: 0, y: 26 }, '-=0.45')
          .from('.hero-sub', { autoAlpha: 0, y: 18 }, '-=0.5')
          .from('.hero-pills > *', { autoAlpha: 0, y: 14, stagger: 0.06 }, '-=0.45')
          .from('.hero-cta', { autoAlpha: 0, y: 14 }, '-=0.5')
          .from('.hero-card', { autoAlpha: 0, y: 34 }, '-=0.7');

        revealOnScroll('.reveal-step', { trigger: '.how-section', stagger: 0.1 });
        revealOnScroll('.reveal-feat', { trigger: '.feat-section', stagger: 0.09 });
        revealOnScroll('.reveal-cta', { trigger: '.cta-section', y: 22 });

        // Amber spotlight follows the cursor across the hero stage.
        const el = rootRef.current;
        if (!el) return;
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * 100;
          const y = ((e.clientY - r.top) / r.height) * 100;
          gsap.to(el, {
            duration: 0.6,
            ease: 'power3.out',
            overwrite: 'auto',
            '--spot-x': `${x}%`,
            '--spot-y': `${y}%`,
          });
        };
        el.addEventListener('pointermove', move);
        return () => el.removeEventListener('pointermove', move);
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(
          ['.hero-brand', '.hero-title', '.hero-sub', '.hero-pills > *', '.hero-cta', '.hero-card', '.reveal-step', '.reveal-feat', '.reveal-cta'],
          { autoAlpha: 1, y: 0 },
        );
      });
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="hds-hero-bg hds-cinema min-h-screen w-full overflow-x-hidden">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="min-h-screen w-full flex items-center justify-center px-6 py-16 lg:py-20">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left: narrative */}
          <div className="max-w-xl mx-auto lg:mx-0 text-center lg:text-left">
            <div className="hero-brand inline-flex items-center gap-3 mb-9">
              <img src="/logo-mark.svg" alt="NextPPT" className="w-9 h-9 rounded-xl shadow-md shadow-black/40" />
              <span className="text-sm font-bold tracking-tight text-[var(--label)]">NextPPT</span>
              <span className="text-[var(--separator)]">·</span>
              <span className="text-xs font-medium text-[var(--tertiary-label)]">下一代 PPT，从 HTML 开始</span>
            </div>

            <h1 className="hero-title hds-hero-title hds-display text-[clamp(2.4rem,5.4vw,4.1rem)]">
              AI 写的 HTML，<br className="hidden sm:block" /><span className="hds-hero-accent">秒变</span>可点编辑的演示稿
            </h1>

            <p className="hero-sub mt-6 text-[15px] lg:text-[17px] text-[var(--secondary-label)] leading-relaxed max-w-md mx-auto lg:mx-0">
              把任意 AI 生成的 HTML 幻灯片拖进来，所见即所得地点选改字、替换图片、实时渲染 Mermaid，再一键导出 PPTX / PDF。无需登录，全程本地。
            </p>

            <div className="hero-pills mt-8 flex flex-wrap gap-2 justify-center lg:justify-start">
              {PILLS.map((p) => (
                <span key={p} className="hds-pill">{p}</span>
              ))}
            </div>

            <button
              onClick={() => openGuide('generate')}
              className="hero-cta mt-9 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--system-blue)] hover:gap-2.5 transition-all"
            >
              第一次用？看 30 秒使用指南
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 3l5 5-5 5" /></svg>
            </button>
          </div>

          {/* Right: the single action hub */}
          <div className="hero-card w-full max-w-lg mx-auto lg:mx-0 lg:justify-self-end">
            <div className="hds-glass-card p-7 sm:p-8">
              {!FS_API_SUPPORTED ? (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-5 text-sm text-amber-200 leading-relaxed">
                  <p className="font-medium mb-1">当前浏览器不支持本地文件读写</p>
                  <p className="text-amber-200/80">
                    本功能依赖 File System Access API，目前仅 Chromium 内核浏览器支持。请使用{' '}
                    <a className="underline" href="https://www.google.com/chrome/" target="_blank" rel="noreferrer">Chrome</a>{' '}
                    或 Edge / Brave / Arc 打开本页面。
                  </p>
                </div>
              ) : (
                <>
                  <div
                    onClick={() => { if (DIR_API_SUPPORTED) void handlePickFolder(); else void handlePickFile(); }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={`relative w-full rounded-2xl px-6 py-14 flex flex-col items-center gap-3 text-center transition-all duration-200 group border-2 border-dashed cursor-pointer ${
                      dragOver ? 'border-[var(--system-blue)] bg-[var(--cobalt-lt)] scale-[1.015]' : 'border-[var(--rule)] hover:border-[var(--system-blue)] hover:bg-[var(--cobalt-lt)]'
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
                      <button onClick={handlePickFolder} disabled={loading} className="hds-btn-primary px-4 py-2 text-xs disabled:opacity-40">
                        打开文件夹
                      </button>
                    )}
                    {FILE_API_SUPPORTED && (
                      <button onClick={handlePickFile} disabled={loading} className="hds-btn px-4 py-2 text-xs disabled:opacity-40">
                        打开单个 HTML
                      </button>
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
                      <button onClick={loadSampleTemplate} disabled={loading} className="hds-btn px-3.5 py-1.5 text-xs disabled:opacity-40">
                        用示例模板体验
                      </button>
                      <a href="/sample-deck.html" download="sample-deck.html" className="hds-btn px-3.5 py-1.5 text-xs inline-block">
                        下载示例模板
                      </a>
                      <button onClick={() => openGuide('generate')} className="hds-btn px-3.5 py-1.5 text-xs">
                        让 AI 帮我写
                      </button>
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

      {/* ── How it works ─────────────────────────────────────────── */}
      <section className="how-section px-6 py-20 lg:py-24">
        <div className="max-w-5xl mx-auto">
          <p className="hds-guide-eyebrow reveal-step">30 秒怎么用</p>
          <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { t: '拿到 HTML', d: '自己写或让 AI 生成一份 .html 演示稿' },
              { t: '点选编辑', d: '所见即所得地改字、换图、渲染 Mermaid' },
              { t: '一键导出', d: '生成可投影的 PPTX / PDF，全程本地' },
            ].map((s, i) => (
              <div key={s.t} className="reveal-step hds-glass-card p-6 flex items-start gap-4">
                <span className="hds-step-num shrink-0">{i + 1}</span>
                <div>
                  <p className="text-[15px] font-semibold text-[var(--label)]">{s.t}</p>
                  <p className="mt-1.5 text-sm text-[var(--secondary-label)] leading-relaxed">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section className="feat-section px-6 pb-20 lg:pb-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="reveal-feat text-2xl lg:text-3xl font-bold tracking-tight text-[var(--label)]">
            把 AI 的草稿，<span className="hds-hero-accent">做成能上台的演示</span>
          </h2>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.k} className="reveal-feat hds-glass-card p-6">
                <span className="text-xs font-mono font-semibold text-[var(--system-blue)]">{f.k}</span>
                <p className="mt-2 text-[15px] font-semibold text-[var(--label)]">{f.title}</p>
                <p className="mt-1.5 text-sm text-[var(--secondary-label)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────── */}
      <section className="cta-section px-6 pb-28">
        <div className="reveal-cta max-w-3xl mx-auto text-center">
          <h2 className="hds-display text-3xl lg:text-[2.6rem] text-[var(--label)]">准备好把草稿搬上台了吗</h2>
          <p className="mt-4 text-[var(--secondary-label)]">把你的 HTML 拖进来，或先看一份示例。</p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            {FS_API_SUPPORTED && (
              <button onClick={() => { if (DIR_API_SUPPORTED) void handlePickFolder(); else void handlePickFile(); }} className="hds-btn-primary px-5 py-2.5 text-sm">
                打开我的 HTML
              </button>
            )}
            <button onClick={() => openGuide('generate')} className="hds-btn px-5 py-2.5 text-sm">
              看使用指南
            </button>
          </div>
        </div>
      </section>

      <footer className="px-6 pb-10 text-center text-xs text-[var(--tertiary-label)]">
        NextPPT · 本地优先 · 数据不离开你的机器
      </footer>
    </div>
  );
}
