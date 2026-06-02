/**
 * Mode-aware history façade. The HistoryDrawer talks only to this module and
 * never cares whether snapshots live on disk (folder mode, `.hds-backup/`) or
 * in IndexedDB (single-file mode).
 */
import { listBackups, readBackup, deleteBackup, writeBackup } from './adapter.js';
import * as snap from './snapshots.js';

export type HistoryCtx =
  | { mode: 'folder'; dir: FileSystemDirectoryHandle }
  | { mode: 'file'; deck: string; fileName: string };

export interface SnapshotMeta {
  /** Opaque id: backup file name (folder) or record key (file). */
  id: string;
  /** Epoch ms for display. */
  ts: number;
  /** Snapshot byte size. */
  size: number;
}

export async function listSnapshots(ctx: HistoryCtx): Promise<SnapshotMeta[]> {
  if (ctx.mode === 'folder') {
    const entries = await listBackups(ctx.dir);
    return entries.map((e) => ({ id: e.name, ts: e.ts, size: e.size }));
  }
  const entries = await snap.listSnapshots(ctx.deck);
  return entries.map((e) => ({ id: e.key, ts: e.ts, size: e.size }));
}

export async function readSnapshot(ctx: HistoryCtx, id: string): Promise<string> {
  if (ctx.mode === 'folder') return readBackup(ctx.dir, id);
  return snap.readSnapshot(id);
}

export async function deleteSnapshot(ctx: HistoryCtx, id: string): Promise<void> {
  if (ctx.mode === 'folder') return deleteBackup(ctx.dir, id);
  return snap.deleteSnapshot(id);
}

/** Record a snapshot of the given HTML (used before restoring, and on file save). */
export async function recordSnapshot(ctx: HistoryCtx, html: string): Promise<void> {
  if (ctx.mode === 'folder') return writeBackup(ctx.dir, html);
  return snap.recordSnapshot(ctx.deck, ctx.fileName, html);
}
