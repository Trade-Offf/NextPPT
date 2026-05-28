import { useState } from 'react';
import type { ExportFormat, ExportResolution, ExportPageRange } from '@hds/protocol';
import { useDeckStore } from '../store/deckStore.js';

/** Recursively append all files from a directory handle to FormData */
async function appendDirFiles(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  form: FormData,
  depth = 0,
): Promise<void> {
  if (depth > 3) return; // safety limit
  for await (const [name, entry] of dir as unknown as AsyncIterable<[string, FileSystemHandle]>) {
    if (name.startsWith('.')) continue; // skip hidden dirs like .hds-backup
    const relPath = prefix ? `${prefix}/${name}` : name;
    if (entry.kind === 'file') {
      const ext = name.split('.').pop()?.toLowerCase() ?? '';
      if (['png','jpg','jpeg','gif','webp','svg','avif','woff','woff2','ttf','css'].includes(ext)) {
        const file = await (entry as FileSystemFileHandle).getFile();
        form.append('files', file, relPath);
      }
    } else if (entry.kind === 'directory') {
      await appendDirFiles(entry as FileSystemDirectoryHandle, relPath, form, depth + 1);
    }
  }
}

interface ExportDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ExportDrawer({ open, onClose }: ExportDrawerProps) {
  const meta = useDeckStore((s) => s.meta);
  const slides = useDeckStore((s) => s.slides);
  const rawHtml = useDeckStore((s) => s.rawHtml);
  const dirHandle = useDeckStore((s) => s.dirHandle);

  const [format, setFormat] = useState<ExportFormat>('pptx');
  const [resolution, setResolution] = useState<ExportResolution>('1280x720@2x');
  const [pageRange, setPageRange] = useState<ExportPageRange>('all');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!rawHtml) return;
    setExporting(true);
    setError(null);
    setProgress(null);

    try {
      // Collect assets from dirHandle if available
      const formData = new FormData();
      formData.append('format', format);
      formData.append('resolution', resolution);
      formData.append('watermark', 'off'); // TODO: tie to plan
      formData.append('pageRange', pageRange);
      formData.append(
        'meta',
        JSON.stringify({ title: meta?.title ?? 'deck', author: meta?.author ?? '' }),
      );

      // Send the original HTML (with relative paths) so Puppeteer can resolve assets
      const deckBlob = new Blob([rawHtml], { type: 'text/html' });
      formData.append('files', deckBlob, 'deck.html');

      // Send ALL files from the directory so Puppeteer can load images
      if (dirHandle) {
        await appendDirFiles(dirHandle, '', formData);
      }

      const res = await fetch('/v1/export', {
        method: 'POST',
        body: formData,
        headers: { 'X-HDS-Trace-Id': crypto.randomUUID() },
      });

      if (!res.ok || !res.body) {
        throw new Error(`Export failed: ${res.status} ${res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let downloadUrl = '';
      let downloadFilename = '';
      let buffer = '';
      let lastEvent = '';

      const handleSseLine = (line: string) => {
        if (line.startsWith('event:')) { lastEvent = line.slice(6).trim(); return; }
        if (!line.startsWith('data:')) return;
        try {
          const data = JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
          if (lastEvent === 'error' || typeof data['message'] === 'string') {
            setError(String(data['message'] ?? data['code'] ?? 'Export failed'));
            lastEvent = '';
            return;
          }
          if (typeof data['current'] === 'number') {
            setProgress({ current: data['current'] as number, total: data['total'] as number });
          }
          if (typeof data['url'] === 'string') {
            downloadUrl = data['url'] as string;
            downloadFilename = (data['filename'] as string | undefined) ?? 'export';
          }
          lastEvent = '';
        } catch { /* ignore malformed lines */ }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        lines.forEach(handleSseLine);
      }
      // flush remaining
      buffer.split('\n').forEach(handleSseLine);

      if (downloadUrl) {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = downloadFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        onClose(); // close only on success
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setExporting(false);
      setProgress(null);
    }
  };

  if (!open) return null;

  const totalSlides = slides.length;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 h-full w-80 bg-white border-l border-[var(--rule)] z-50 flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--rule)]">
          <h2 className="text-base font-semibold text-[var(--ink)]">导出</h2>
          <button onClick={onClose} className="text-[var(--silver)] hover:text-[var(--ink)]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-5 p-5">
          {/* Format */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--slate)]">格式</span>
            <div className="flex gap-2">
              {(['pptx', 'pdf'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                    format === f
                      ? 'bg-[var(--cobalt)] text-white border-[var(--cobalt)]'
                      : 'border-[var(--rule)] text-[var(--slate)] hover:border-[var(--cobalt)]'
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </label>

          {/* Resolution */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--slate)]">分辨率</span>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value as ExportResolution)}
              className="border border-[var(--rule)] rounded-md px-3 py-2 text-sm"
            >
              <option value="1280x720@2x">标准 1280×720@2x</option>
              <option value="1920x1080@2x" disabled>高清 1920×1080@2x（Pro）</option>
              <option value="3840x2160@2x" disabled>4K（Pro）</option>
            </select>
          </label>

          {/* Page range */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--slate)]">页码范围</span>
            <div className="flex flex-col gap-2">
              {[
                { label: '全部页面', value: 'all' },
                { label: '当前页', value: 'current' },
              ].map(({ label, value }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="pageRange"
                    value={value}
                    checked={pageRange === value}
                    onChange={() => setPageRange(value as ExportPageRange)}
                  />
                  <span className="text-sm text-[var(--slate)]">{label}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pageRange"
                  value="custom"
                  checked={pageRange !== 'all' && pageRange !== 'current'}
                  onChange={() => setPageRange('1')}
                />
                <span className="text-sm text-[var(--slate)]">自定义</span>
              </label>
              {pageRange !== 'all' && pageRange !== 'current' && (
                <input
                  type="text"
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                  placeholder={`1-${totalSlides} 或 1,3-5,8`}
                  className="border border-[var(--rule)] rounded px-2 py-1 text-sm font-mono"
                />
              )}
            </div>
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-600">{error}</div>
          )}

          {progress && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-[var(--slate)]">
                <span>截图进度</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div className="h-1.5 bg-[var(--rule)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--cobalt)] transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[var(--rule)]">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full py-2.5 rounded-lg bg-[var(--cobalt)] text-white text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            {exporting ? '导出中…' : `开始导出 ${format.toUpperCase()}`}
          </button>
        </div>
      </aside>
    </>
  );
}
