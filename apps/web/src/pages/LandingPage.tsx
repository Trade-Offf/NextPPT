import { useState } from 'react';
import { useDeckStore } from '../store/deckStore.js';
import { pickDirectory, pickFile, recallHandle, verifyPermission, findDeckFile, parseDeck } from '../fs/adapter.js';
import { resolveAssetsInHtml, revokeAssetCache } from '../fs/assetResolver.js';
import { GenerateGuideModal } from '../components/GenerateGuideModal.js';

const DIR_API_SUPPORTED = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
const FILE_API_SUPPORTED = typeof window !== 'undefined' && 'showOpenFilePicker' in window;
const FS_API_SUPPORTED = DIR_API_SUPPORTED || FILE_API_SUPPORTED;

export function LandingPage() {
  const openDirectory = useDeckStore((s) => s.openDirectory);
  const openFile = useDeckStore((s) => s.openFile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const openDeck = async (handle: FileSystemDirectoryHandle) => {
    setLoading(true);
    setError(null);
    try {
      const ok = await verifyPermission(handle);
      if (!ok) throw new Error('需要文件夹访问权限');

      const result = await findDeckFile(handle);
      if (!result) throw new Error('未找到 HTML 幻灯片文件。请确认文件夹中包含带有 <section class="slide"> 的 HTML 文件。');

      const { fileName, html } = result;
      const { meta, headHtml: rawHead, slides: rawSlides } = parseDeck(html);

      revokeAssetCache();

      const resolvedSlides = await Promise.all(
        rawSlides.map(async (slide) => ({
          ...slide,
          html: await resolveAssetsInHtml(slide.html, handle),
        })),
      );
      const headHtml = await resolveAssetsInHtml(rawHead, handle);

      openDirectory(handle, fileName, html, headHtml, meta, resolvedSlides);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePickFolder = async () => {
    if (!DIR_API_SUPPORTED) return;
    try {
      const handle = await pickDirectory();
      await openDeck(handle);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(String(err));
    }
  };

  // Single self-contained HTML file (no folder, no relative assets).
  const openSingleFile = (fileName: string, html: string) => {
    setError(null);
    const { meta, headHtml, slides } = parseDeck(html);
    if (!slides.length) {
      setError('未在该 HTML 中找到 <section class="slide"> 幻灯片。');
      return;
    }
    revokeAssetCache();
    openFile(fileName, html, headHtml, meta, slides);
  };

  const handlePickFile = async () => {
    if (!FILE_API_SUPPORTED) return;
    try {
      const { fileName, html } = await pickFile();
      openSingleFile(fileName, html);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(String(err));
    }
  };

  // Load the bundled self-contained sample deck straight into the editor.
  const loadSampleTemplate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/sample-deck.html');
      if (!res.ok) throw new Error('示例模板加载失败，请稍后重试');
      openSingleFile('sample-deck.html', await res.text());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRecall = async () => {
    try {
      const handle = await recallHandle();
      if (!handle) return;
      await openDeck(handle);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!FS_API_SUPPORTED) return;
    const item = e.dataTransfer.items?.[0] as
      | (DataTransferItem & { getAsFileSystemHandle?: () => Promise<FileSystemHandle> })
      | undefined;
    try {
      const handle = await item?.getAsFileSystemHandle?.();
      if (handle?.kind === 'directory') {
        await openDeck(handle as FileSystemDirectoryHandle);
        return;
      }
      if (handle?.kind === 'file') {
        const file = await (handle as FileSystemFileHandle).getFile();
        if (!file.name.toLowerCase().endsWith('.html') && !file.name.toLowerCase().endsWith('.htm')) {
          setError('请拖入 HTML 文件或包含 HTML 的文件夹。');
          return;
        }
        openSingleFile(file.name, await file.text());
        return;
      }
      // Fallback: plain dropped file (no FS handle)
      const plain = e.dataTransfer.files?.[0];
      if (plain && /\.html?$/i.test(plain.name)) {
        openSingleFile(plain.name, await plain.text());
        return;
      }
      setError('请拖入 HTML 文件或包含 HTML 的文件夹。');
    } catch (err) {
      setError(String(err));
    }
  };

  const FEATURES = [
    { label: '点选即改字' },
    { label: 'Mermaid 实时渲染' },
    { label: '一键导出 PPTX · PDF' },
    { label: '本地优先 · 数据不离开本机' },
  ];

  return (
    <div className="hds-hero-bg min-h-screen w-full flex items-center justify-center px-6 py-10 lg:py-16">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-16 items-center">

        {/* ── Left: product narrative ───────────────────────────── */}
        <div className="hds-fade-up max-w-xl mx-auto lg:mx-0 text-center lg:text-left">
          <div className="flex items-center gap-3 justify-center lg:justify-start mb-7">
            <div className="w-10 h-10 rounded-2xl bg-[var(--system-blue)] flex items-center justify-center text-white font-bold text-lg shadow-md shadow-[rgba(0,122,255,0.35)]">H</div>
            <span className="text-sm font-semibold tracking-wide text-[var(--secondary-label)]">HTML Deck Studio</span>
          </div>

          <h1 className="hds-hero-title text-[clamp(2rem,4.4vw,3.4rem)] font-bold leading-[1.08] tracking-tight">
            AI 写的 HTML，<br className="hidden sm:block" />秒变可点编辑的演示稿
          </h1>

          <p className="mt-5 text-[15px] lg:text-base text-[var(--secondary-label)] leading-relaxed max-w-md mx-auto lg:mx-0">
            把任意 AI 生成的 HTML 幻灯片拖进来，所见即所得地点选改字、替换图片、实时渲染 Mermaid，再一键导出 PPTX / PDF。无需登录，全程本地。
          </p>

          <div className="mt-7 flex flex-wrap gap-2 justify-center lg:justify-start">
            {FEATURES.map((f) => (
              <span key={f.label} className="hds-pill">{f.label}</span>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-3 justify-center lg:justify-start flex-wrap">
            <button
              onClick={() => { if (DIR_API_SUPPORTED) void handlePickFolder(); else void handlePickFile(); }}
              disabled={loading || !FS_API_SUPPORTED}
              className="hds-btn-primary px-5 py-2.5 text-sm disabled:opacity-40"
            >
              {loading ? '加载中…' : '打开我的演示稿'}
            </button>
            <button
              onClick={() => setShowGuide(true)}
              className="hds-btn px-5 py-2.5 text-sm inline-flex items-center gap-1.5"
            >
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M10 2.5l1.6 4.3 4.4.3-3.4 2.9 1.1 4.3L10 12.2 6.3 14.6l1.1-4.3-3.4-2.9 4.4-.3z" /></svg>
              用 AI 生成演示稿
            </button>
          </div>
        </div>

        {/* ── Right: action card ────────────────────────────────── */}
        <div className="hds-fade-up hds-fade-up-delay w-full max-w-md mx-auto">
          <div className="hds-glass-card p-6 sm:p-7">
            {!FS_API_SUPPORTED ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 leading-relaxed">
                <p className="font-medium mb-1">当前浏览器不支持本地文件读写</p>
                <p className="text-amber-700">
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
                  className={`relative w-full rounded-2xl px-6 py-10 flex flex-col items-center gap-3 text-center transition-colors group border-2 border-dashed cursor-pointer ${
                    dragOver ? 'border-[var(--system-blue)] bg-[var(--cobalt-lt)]' : 'border-[var(--rule)] hover:border-[var(--system-blue)] hover:bg-[var(--cobalt-lt)]'
                  } ${loading ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  <svg className="w-11 h-11 text-[var(--tertiary-label)] group-hover:text-[var(--system-blue)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  </svg>
                  <span className="text-sm font-medium text-[var(--label)] group-hover:text-[var(--system-blue)]">
                    {loading ? '加载中…' : '点击选择，或拖拽文件夹 / HTML 到此处'}
                  </span>
                  <span className="text-xs text-[var(--tertiary-label)] leading-relaxed">文件夹模式可读写配套图片；单个 HTML 适合自包含演示稿</span>
                </div>

                {/* Explicit entry buttons */}
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

                {/* Template / generate row */}
                <div className="mt-5 pt-4 border-t border-[var(--separator)]">
                  <p className="text-xs text-[var(--secondary-label)] text-center mb-3">还没有演示稿？</p>
                  <div className="flex items-center justify-center gap-2.5 flex-wrap">
                    <button onClick={loadSampleTemplate} disabled={loading} className="hds-btn px-3.5 py-1.5 text-xs disabled:opacity-40">
                      用示例模板体验
                    </button>
                    <a href="/sample-deck.html" download="sample-deck.html" className="hds-btn px-3.5 py-1.5 text-xs inline-block">
                      下载示例模板
                    </a>
                    <button onClick={() => setShowGuide(true)} className="hds-btn px-3.5 py-1.5 text-xs">
                      让 AI 帮我写
                    </button>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 leading-relaxed">
                <p>{error}</p>
                {/未找到|未在该 HTML/.test(error) && (
                  <p className="mt-2 text-red-500">
                    没有现成的演示稿？点上方「用示例模板体验」「下载示例模板」，或「让 AI 帮我写」获取一份带{' '}
                    <code className="font-mono">&lt;section class="slide"&gt;</code> 的标准范例。
                  </p>
                )}
              </div>
            )}
          </div>

          <p className="mt-5 text-center text-[11px] text-[var(--tertiary-label)]">
            本地优先 · 无需登录 · 数据不离开本机
          </p>
        </div>
      </div>

      {showGuide && (
        <GenerateGuideModal onClose={() => setShowGuide(false)} onUseTemplate={loadSampleTemplate} />
      )}
    </div>
  );
}
