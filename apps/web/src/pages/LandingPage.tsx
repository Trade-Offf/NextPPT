import { useState } from 'react';
import { useDeckStore } from '../store/deckStore.js';
import { pickDirectory, pickFile, recallHandle, verifyPermission, findDeckFile, parseDeck } from '../fs/adapter.js';
import { resolveAssetsInHtml, revokeAssetCache } from '../fs/assetResolver.js';

const DIR_API_SUPPORTED = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
const FILE_API_SUPPORTED = typeof window !== 'undefined' && 'showOpenFilePicker' in window;
const FS_API_SUPPORTED = DIR_API_SUPPORTED || FILE_API_SUPPORTED;

export function LandingPage() {
  const openDirectory = useDeckStore((s) => s.openDirectory);
  const openFile = useDeckStore((s) => s.openFile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

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

  return (
    <div className="hds-landing-bg min-h-screen flex items-center justify-center p-8">
      <div className="hds-window w-full max-w-2xl">
        {/* Title bar */}
        <div className="hds-window-titlebar">
          <div className="hds-traffic-lights" aria-hidden>
            <span className="tl tl-red" />
            <span className="tl tl-amber" />
            <span className="tl tl-green" />
          </div>
          <span className="hds-window-title">HTML Deck Studio</span>
        </div>

        {/* Content */}
        <div className="px-10 py-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-[var(--system-blue)] flex items-center justify-center text-white font-bold text-lg shadow-sm">H</div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--label)] leading-tight">HTML Deck Studio</h1>
              <p className="text-xs text-[var(--secondary-label)]">点哪改哪的 AI 演示稿编辑器 · 一键导出 PPTX / PDF</p>
            </div>
          </div>

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
                className={`relative w-full rounded-2xl p-12 flex flex-col items-center gap-3 text-center transition-colors group border-2 border-dashed cursor-pointer ${
                  dragOver ? 'border-[var(--system-blue)] bg-[var(--cobalt-lt)]' : 'border-[var(--rule)] hover:border-[var(--system-blue)] hover:bg-[var(--cobalt-lt)]'
                } ${loading ? 'opacity-60 pointer-events-none' : ''}`}
              >
                <svg className="w-12 h-12 text-[var(--tertiary-label)] group-hover:text-[var(--system-blue)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
                <span className="text-sm font-medium text-[var(--label)] group-hover:text-[var(--system-blue)]">
                  {loading ? '加载中…' : '点击选择，或拖拽文件夹 / HTML 文件到此处'}
                </span>
                <span className="text-xs text-[var(--tertiary-label)]">文件夹模式可读写配套图片资源；单个 HTML 适合自包含演示稿</span>
              </div>

              {/* Explicit entry buttons */}
              <div className="mt-4 flex items-center justify-center gap-3">
                {DIR_API_SUPPORTED && (
                  <button
                    onClick={handlePickFolder}
                    disabled={loading}
                    className="hds-btn-primary px-4 py-2 text-xs disabled:opacity-40"
                  >
                    打开文件夹
                  </button>
                )}
                {FILE_API_SUPPORTED && (
                  <button
                    onClick={handlePickFile}
                    disabled={loading}
                    className="hds-btn px-4 py-2 text-xs disabled:opacity-40"
                  >
                    打开单个 HTML 文件
                  </button>
                )}
              </div>

              {DIR_API_SUPPORTED && (
                <button
                  onClick={handleRecall}
                  disabled={loading}
                  className="mt-3 text-xs text-[var(--system-blue)] hover:underline self-center disabled:opacity-40 block mx-auto"
                >
                  重新打开上次的文件夹
                </button>
              )}
            </>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600">
              {error}
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-2 justify-center">
            {['点击选中元素', '双击行内改字', 'Mermaid 实时渲染', '导出 PPTX / PDF', '自动保存与备份'].map((f) => (
              <span key={f} className="px-2.5 py-1 bg-[var(--control-bg)] border border-[var(--rule)] rounded-full text-xs text-[var(--secondary-label)]">
                {f}
              </span>
            ))}
          </div>

          <p className="mt-6 text-center text-[11px] text-[var(--tertiary-label)]">
            本地优先 · 无需登录 · 数据不离开本机
          </p>
        </div>
      </div>
    </div>
  );
}
