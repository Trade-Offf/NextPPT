import { useState } from 'react';
import { useDeckStore } from '../store/deckStore.js';
import { pickDirectory, recallHandle, verifyPermission, findDeckFile, parseDeck } from '../fs/adapter.js';

export function LandingPage() {
  const openDirectory = useDeckStore((s) => s.openDirectory);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDeck = async (handle: FileSystemDirectoryHandle) => {
    setLoading(true);
    setError(null);
    try {
      const ok = await verifyPermission(handle);
      if (!ok) throw new Error('需要文件夹访问权限');

      const result = await findDeckFile(handle);
      if (!result) throw new Error('未找到 HTML 幻灯片文件。请确认文件夹中包含带有 <section class="slide"> 的 HTML 文件。');

      const { fileName, html } = result;
      const { meta, slides } = parseDeck(html);
      openDirectory(handle, fileName, html, meta, slides);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePickFolder = async () => {
    try {
      const handle = await pickDirectory();
      await openDeck(handle);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eff6ff] via-white to-[#f8faff] flex items-center justify-center p-8">
      <div className="max-w-xl w-full">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-[var(--cobalt)] flex items-center justify-center text-white font-bold text-lg">H</div>
          <div>
            <h1 className="text-xl font-bold text-[var(--ink)]">HTML Deck Studio</h1>
            <p className="text-xs text-[var(--silver)]">Visual editor & pixel-perfect exporter</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[var(--rule)] shadow-sm p-8 flex flex-col gap-6">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink)] mb-1">打开幻灯片文件夹</h2>
            <p className="text-sm text-[var(--slate)] leading-relaxed">
              选择包含 HTML 幻灯片及配套图片资源的文件夹。HDS 会自动识别幻灯片文件并加载页面列表。
            </p>
          </div>

          {/* Drop zone / button */}
          <button
            onClick={handlePickFolder}
            disabled={loading}
            className="relative w-full border-2 border-dashed border-[var(--rule)] rounded-xl p-10 flex flex-col items-center gap-3 text-center hover:border-[var(--cobalt)] hover:bg-[var(--cobalt-lt)] transition-colors group"
          >
            <svg className="w-12 h-12 text-[var(--silver)] group-hover:text-[var(--cobalt)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
            <span className="text-sm font-medium text-[var(--slate)] group-hover:text-[var(--cobalt)]">
              {loading ? '加载中…' : '点击选择文件夹'}
            </span>
            <span className="text-xs text-[var(--silver)]">需要 Chromium 内核浏览器（Chrome / Edge）</span>
          </button>

          <button
            onClick={handleRecall}
            disabled={loading}
            className="text-xs text-[var(--cobalt)] hover:underline self-center disabled:opacity-40"
          >
            重新打开上次的文件夹
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Feature chips */}
        <div className="mt-8 flex flex-wrap gap-2 justify-center">
          {['点击选中元素', '修改文字/颜色/字号', 'Mermaid 实时渲染', '导出 PPTX / PDF', '自动备份文件'].map((f) => (
            <span key={f} className="px-2.5 py-1 bg-white border border-[var(--rule)] rounded-full text-xs text-[var(--slate)]">
              {f}
            </span>
          ))}
        </div>

        <p className="mt-6 text-center text-[10px] text-[var(--silver)]">
          本地优先 · 无需登录 · 数据不离开本机
        </p>
      </div>
    </div>
  );
}
