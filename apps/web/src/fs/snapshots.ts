/**
 * Single-file mode history snapshots, stored in IndexedDB.
 *
 * Folder mode keeps timestamped snapshots in `.hds-backup/` on disk; single
 * files have no folder, so we persist snapshots in the browser instead, keyed
 * by the source file name (deck key). Pruned to MAX_SNAPSHOTS per deck.
 */
import { openIdb, IDB_SNAPSHOTS } from './adapter.js';

const MAX_SNAPSHOTS = 50;

interface SnapshotRecord {
  /** Primary key: `${deck}::${ts}` */
  key: string;
  /** Deck key (source file name). */
  deck: string;
  /** Epoch ms. */
  ts: number;
  /** Working-copy file name at save time. */
  fileName: string;
  /** Full deck HTML. */
  html: string;
}

export interface SnapshotEntry {
  key: string;
  ts: number;
  size: number;
}

function allForDeck(db: IDBDatabase, deck: string): Promise<SnapshotRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_SNAPSHOTS, 'readonly');
    const index = tx.objectStore(IDB_SNAPSHOTS).index('deck');
    const req = index.getAll(IDBKeyRange.only(deck));
    req.onsuccess = () => resolve((req.result as SnapshotRecord[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function recordSnapshot(deck: string, fileName: string, html: string): Promise<void> {
  if (!deck) return;
  const db = await openIdb();
  const ts = Date.now();
  const record: SnapshotRecord = { key: `${deck}::${ts}`, deck, ts, fileName, html };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_SNAPSHOTS, 'readwrite');
    tx.objectStore(IDB_SNAPSHOTS).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Prune oldest beyond the cap.
  const all = (await allForDeck(db, deck)).sort((a, b) => a.ts - b.ts);
  if (all.length > MAX_SNAPSHOTS) {
    const excess = all.slice(0, all.length - MAX_SNAPSHOTS);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_SNAPSHOTS, 'readwrite');
      const store = tx.objectStore(IDB_SNAPSHOTS);
      for (const rec of excess) store.delete(rec.key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export async function listSnapshots(deck: string): Promise<SnapshotEntry[]> {
  if (!deck) return [];
  const db = await openIdb();
  const all = await allForDeck(db, deck);
  return all
    .map((r) => ({ key: r.key, ts: r.ts, size: r.html.length }))
    .sort((a, b) => b.ts - a.ts); // newest first
}

export async function readSnapshot(key: string): Promise<string> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_SNAPSHOTS, 'readonly');
    const req = tx.objectStore(IDB_SNAPSHOTS).get(key);
    req.onsuccess = () => resolve(((req.result as SnapshotRecord | undefined)?.html) ?? '');
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSnapshot(key: string): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_SNAPSHOTS, 'readwrite');
    tx.objectStore(IDB_SNAPSHOTS).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
