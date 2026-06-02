import { useCallback, useEffect, useState } from 'react';
import type { HistoryCtx, SnapshotMeta } from '../fs/history.js';
import { listSnapshots, readSnapshot, deleteSnapshot } from '../fs/history.js';

interface HistoryDrawerProps {
  open: boolean;
  ctx: HistoryCtx;
  onClose: () => void;
  onRestore: (html: string) => Promise<void> | void;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(ts).toLocaleDateString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function HistoryDrawer({ open, ctx, onClose, onRestore }: HistoryDrawerProps) {
  const [entries, setEntries] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listSnapshots(ctx);
      setEntries(list);
      setSelectedId((prev) => (prev && list.some((e) => e.id === prev) ? prev : list[0]?.id ?? null));
    } catch (err) {
      console.error('list snapshots failed', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
    // ctx is rebuilt each render; depend on its primitive fields instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.mode, ctx.mode === 'folder' ? ctx.dir : ctx.deck]);

  useEffect(() => {
    if (!open) return;
    // Defer so the state updates happen in a callback, not synchronously here.
    void Promise.resolve().then(refresh);
  }, [open, refresh]);

  // Load preview for the selected snapshot.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      if (!selectedId) { if (!cancelled) setPreviewHtml(''); return; }
      try {
        const html = await readSnapshot(ctx, selectedId);
        if (!cancelled) setPreviewHtml(html);
      } catch {
        if (!cancelled) setPreviewHtml('');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedId]);

  const handleRestore = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const html = await readSnapshot(ctx, selectedId);
      await onRestore(html);
      onClose();
    } catch (err) {
      console.error('restore failed', err);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      await deleteSnapshot(ctx, id);
      await refresh();
    } catch (err) {
      console.error('delete snapshot failed', err);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      <aside className="hds-panel hds-drawer fixed right-0 top-0 h-full w-[380px] z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--separator)]">
          <h2 className="text-base font-semibold text-[var(--label)]">历史版本</h2>
          <button onClick={onClose} className="text-[var(--tertiary-label)] hover:text-[var(--label)]" aria-label="关闭">✕</button>
        </div>

        {/* Preview */}
        <div className="px-5 pt-4">
          <div className="rounded-lg overflow-hidden border border-[var(--separator)] bg-white aspect-video">
            {previewHtml ? (
              <iframe
                title="快照预览"
                srcDoc={previewHtml}
                sandbox=""
                className="origin-top-left border-0 pointer-events-none"
                style={{ width: 1280, height: 720, transform: 'scale(0.265)' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-[var(--tertiary-label)]">
                {loading ? '加载中…' : '选择一个版本预览'}
              </div>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1">
          {!loading && entries.length === 0 && (
            <div className="text-center text-xs text-[var(--tertiary-label)] py-10 px-4 leading-relaxed">
              暂无历史版本。<br />每次保存都会自动记录一个可恢复的快照。
            </div>
          )}
          {entries.map((e) => (
            <div
              key={e.id}
              onClick={() => setSelectedId(e.id)}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                selectedId === e.id ? 'bg-[var(--cobalt-lt)]' : 'hover:bg-[var(--control-bg)]'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[var(--label)] truncate">{formatRelative(e.ts)}</p>
                <p className="text-[11px] text-[var(--tertiary-label)]">
                  {new Date(e.ts).toLocaleString()} · {formatSize(e.size)}
                </p>
              </div>
              <button
                onClick={(ev) => { ev.stopPropagation(); void handleDelete(e.id); }}
                disabled={busy}
                className="opacity-0 group-hover:opacity-100 text-[var(--tertiary-label)] hover:text-red-500 transition-opacity text-xs px-1.5 py-1 disabled:opacity-30"
                aria-label="删除此版本"
                title="删除此版本"
              >
                删除
              </button>
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-[var(--separator)]">
          <button
            onClick={() => void handleRestore()}
            disabled={busy || !selectedId}
            className="hds-btn-primary w-full py-2.5 text-sm font-medium disabled:opacity-40"
          >
            {busy ? '处理中…' : '恢复到此版本'}
          </button>
          <p className="text-[11px] text-[var(--tertiary-label)] text-center mt-2 leading-relaxed">
            恢复前会先把当前内容存为一个新版本，可随时再切回。
          </p>
        </div>
      </aside>
    </>
  );
}
