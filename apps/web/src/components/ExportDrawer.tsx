import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExportFormat, ExportResolution, ExportPageRange } from '@hds/protocol';
import { useDeckStore } from '../store/deckStore.js';
import { rebuildDeckHtmlForExport, rebuildDocHtmlForExport } from '../fs/adapter.js';
import { getBlobToPathMap } from '../fs/assetResolver.js';

/**
 * Base URL of the export API. Empty in dev (Vite proxies /v1 to localhost:3000);
 * in production set VITE_API_BASE to e.g. https://api.next-ppt.com at build time.
 */
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

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
  const { t } = useTranslation('editor');
  const meta = useDeckStore((s) => s.meta);
  const slides = useDeckStore((s) => s.slides);
  const rawHtml = useDeckStore((s) => s.rawHtml);
  const dirHandle = useDeckStore((s) => s.dirHandle);
  const kind = useDeckStore((s) => s.kind);
  const docMode = kind === 'doc';

  const [format, setFormat] = useState<ExportFormat>(docMode ? 'pdf' : 'pptx');
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
      formData.append('mode', docMode ? 'doc' : 'deck');
      formData.append(
        'meta',
        JSON.stringify({ title: meta?.title ?? 'deck', author: meta?.author ?? '' }),
      );

      // Rebuild HTML from edits; restore blob: → relative paths for Puppeteer.
      const exportHtml = docMode
        ? rebuildDocHtmlForExport(rawHtml, slides, getBlobToPathMap())
        : rebuildDeckHtmlForExport(rawHtml, slides, getBlobToPathMap());
      const deckBlob = new Blob([exportHtml], { type: 'text/html' });
      formData.append('files', deckBlob, 'deck.html');

      // Send ALL files from the directory so Puppeteer can load images
      if (dirHandle) {
        await appendDirFiles(dirHandle, '', formData);
      }

      // 1. Kick off the export. The server returns a jobId immediately and runs
      // the heavy work in the background, so a dropped connection no longer
      // fails the export.
      const res = await fetch(`${API_BASE}/v1/export`, {
        method: 'POST',
        body: formData,
        headers: { 'X-HDS-Trace-Id': crypto.randomUUID() },
      });

      if (!res.ok) {
        let detail = `${res.status} ${res.statusText}`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) detail = body.error;
        } catch { /* non-JSON body */ }
        throw new Error(`Export failed: ${detail}`);
      }

      const { jobId } = (await res.json()) as { jobId?: string };
      if (!jobId) throw new Error('Export failed: no jobId returned');

      // 2. Subscribe to progress over a reconnectable SSE stream. EventSource
      // auto-reconnects on network blips and picks up the latest job state, so
      // ERR_NETWORK_CHANGED mid-export no longer loses the work.
      const { url: downloadUrl, filename: downloadFilename } = await new Promise<{
        url: string;
        filename: string;
      }>((resolve, reject) => {
        const es = new EventSource(`${API_BASE}/v1/export/${jobId}/events`);
        // Guard against an endless reconnect loop if the stream never recovers.
        let consecutiveErrors = 0;

        es.addEventListener('progress', (evt) => {
          consecutiveErrors = 0;
          try {
            const data = JSON.parse((evt as MessageEvent).data) as {
              current: number;
              total: number;
            };
            if (typeof data.current === 'number') {
              setProgress({ current: data.current, total: data.total });
            }
          } catch { /* ignore malformed lines */ }
        });

        es.addEventListener('done', (evt) => {
          try {
            const data = JSON.parse((evt as MessageEvent).data) as {
              url?: string;
              filename?: string;
            };
            es.close();
            if (data.url) resolve({ url: data.url, filename: data.filename ?? 'export' });
            else reject(new Error('Export finished without a download URL'));
          } catch (e) {
            es.close();
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        });

        es.addEventListener('failed', (evt) => {
          es.close();
          try {
            const data = JSON.parse((evt as MessageEvent).data) as {
              message?: string;
              code?: string;
            };
            reject(new Error(String(data.message ?? data.code ?? 'Export failed')));
          } catch {
            reject(new Error('Export failed'));
          }
        });

        // Built-in connection-error event (distinct from our 'failed' event).
        // Let EventSource retry a few times before giving up.
        es.addEventListener('error', () => {
          consecutiveErrors += 1;
          if (consecutiveErrors >= 6) {
            es.close();
            reject(new Error('Lost connection to export progress stream'));
          }
        });
      });

      // 3. Download the finished artifact. The download endpoint supports
      // HTTP Range, so an interrupted download resumes instead of restarting.
      const a = document.createElement('a');
      a.href = downloadUrl.startsWith('http') ? downloadUrl : `${API_BASE}${downloadUrl}`;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      onClose(); // close only on success
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
      <aside className="hds-panel hds-drawer fixed right-0 top-0 h-full w-80 z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--separator)]">
          <h2 className="text-base font-semibold text-[var(--label)]">{t('exportDrawer.title')}</h2>
          <button onClick={onClose} className="text-[var(--tertiary-label)] hover:text-[var(--label)]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-5 p-5">
          {/* Format */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--secondary-label)]">{t('exportDrawer.format')}</span>
            <div className="hds-segmented w-full">
              {(docMode ? (['pdf', 'png'] as const) : (['pptx', 'pdf'] as const)).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`hds-segment flex-1 ${format === f ? 'is-active' : ''}`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            {docMode && (
              <span className="text-[11px] text-[var(--tertiary-label)] mt-1">
                {format === 'pdf' ? t('exportDrawer.docPdfHint') : t('exportDrawer.docPngHint')}
              </span>
            )}
          </label>

          {/* Resolution (vector PDF in doc mode ignores it, so it's hidden there) */}
          {(!docMode || format === 'png') && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--slate)]">{t('exportDrawer.resolution')}</span>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value as ExportResolution)}
              className="border border-[var(--rule)] rounded-md px-3 py-2 text-sm"
            >
              <option value="1280x720@2x">{t('exportDrawer.resStandard')}</option>
              <option value="1920x1080@2x">{t('exportDrawer.resHd')}</option>
              <option value="3840x2160@2x">{t('exportDrawer.resUhd')}</option>
            </select>
          </label>
          )}

          {/* Page range — deck only (a doc is one smart-paginated document) */}
          {!docMode && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--slate)]">{t('exportDrawer.pageRange')}</span>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pageRange"
                  value="all"
                  checked={pageRange === 'all'}
                  onChange={() => setPageRange('all')}
                />
                <span className="text-sm text-[var(--slate)]">{t('exportDrawer.rangeAll')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pageRange"
                  value="custom"
                  checked={pageRange !== 'all'}
                  onChange={() => setPageRange('1')}
                />
                <span className="text-sm text-[var(--slate)]">{t('exportDrawer.rangeCustom')}</span>
              </label>
              {pageRange !== 'all' && (
                <input
                  type="text"
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                  placeholder={t('exportDrawer.rangePlaceholder', { total: totalSlides })}
                  className="border border-[var(--rule)] rounded px-2 py-1 text-sm font-mono"
                />
              )}
            </div>
          </label>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-600">{error}</div>
          )}

          {progress && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-[var(--slate)]">
                <span>{t('exportDrawer.progress')}</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div className="h-1.5 bg-[var(--rule)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--cobalt)] transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[var(--rule)]">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="hds-btn-primary w-full py-2.5 text-sm font-medium"
          >
            {exporting ? t('exportDrawer.exporting') : t('exportDrawer.start', { format: format.toUpperCase() })}
          </button>
        </div>
      </aside>
    </>
  );
}
