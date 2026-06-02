/**
 * File System Access API adapter.
 * All disk I/O lives here; the rest of the app only sees DeckStore.
 */
import { ulid } from '../lib/ulid.js';
import type { DeckMeta } from '@hds/protocol';
import { SLIDE_SELECTOR } from '@hds/protocol';
import type { SlideState } from '../store/deckStore.js';

const IDB_DB = 'hds-v1';
const IDB_STORE = 'handles';
export const IDB_SNAPSHOTS = 'snapshots';
const BACKUP_DIR = '.hds-backup';
const MAX_BACKUPS = 50;

// ─── IndexedDB handle persistence ───────────────────────────────────────────

/**
 * Shared IndexedDB connection. v2 adds the `snapshots` object store used by
 * single-file history (see fs/snapshots.ts). Both stores are created/ensured
 * here so there is exactly one schema version for the `hds-v1` database.
 */
export function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      if (!db.objectStoreNames.contains(IDB_SNAPSHOTS)) {
        const store = db.createObjectStore(IDB_SNAPSHOTS, { keyPath: 'key' });
        store.createIndex('deck', 'deck', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function persistHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(handle, 'last');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function recallHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get('last');
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

// ─── Directory picker ────────────────────────────────────────────────────────

export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  // showDirectoryPicker is a Chrome-specific API; cast to any to avoid strict TS checks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' }) as FileSystemDirectoryHandle;
  await persistHandle(handle);
  return handle;
}

/** Single-file mode: pick one self-contained .html file (no folder). */
export async function pickFile(): Promise<{ fileName: string; html: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [handle] = (await (window as any).showOpenFilePicker({
    types: [{ description: 'HTML', accept: { 'text/html': ['.html', '.htm'] } }],
    multiple: false,
  })) as FileSystemFileHandle[];
  const file = await handle.getFile();
  const html = await file.text();
  return { fileName: handle.name, html };
}

/** Single-file mode: prompt "save as" and write the working copy, returning its handle. */
export async function saveAsNewFile(suggestedName: string, html: string): Promise<FileSystemFileHandle> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handle = (await (window as any).showSaveFilePicker({
    suggestedName,
    types: [{ description: 'HTML', accept: { 'text/html': ['.html'] } }],
  })) as FileSystemFileHandle;
  await writeFileHandle(handle, html);
  return handle;
}

/** Single-file mode: write to an already-acquired file handle (no backup dir available). */
export async function writeFileHandle(handle: FileSystemFileHandle, html: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(html);
  await writable.close();
}

export async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  // queryPermission / requestPermission are part of File System Access API (Chrome-only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const h = handle as any;
  const perm = await h.queryPermission?.({ mode: 'readwrite' }) as string | undefined;
  if (perm === 'granted') return true;
  const req = await h.requestPermission?.({ mode: 'readwrite' }) as string | undefined;
  return req === 'granted';
}

// ─── Reading deck ─────────────────────────────────────────────────────────

export async function findDeckFile(
  dir: FileSystemDirectoryHandle,
): Promise<{ fileName: string; html: string } | null> {
  for await (const [name, entry] of dir as unknown as AsyncIterable<[string, FileSystemHandle]>) {
    if (entry.kind !== 'file' || !name.endsWith('.html')) continue;
    const file = await (entry as FileSystemFileHandle).getFile();
    const html = await file.text();
    if (html.includes(SLIDE_SELECTOR.replace('.', ' class="').replace('.', ' '))) {
      // Quick heuristic match for <section class="slide">
      return { fileName: name, html };
    }
    // Fallback: any html with the slide class
    if (html.includes('class="slide"')) return { fileName: name, html };
  }
  return null;
}

export function parseDeck(html: string): { meta: DeckMeta; headHtml: string; slides: SlideState[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const sections = Array.from(doc.querySelectorAll<HTMLElement>(SLIDE_SELECTOR));

  const slides: SlideState[] = sections.map((el, idx) => {
    let id = el.getAttribute('data-page-id') ?? '';
    if (!id) {
      id = ulid();
      el.setAttribute('data-page-id', id);
    }
    const ordinal = parseInt(el.getAttribute('data-page') ?? String(idx + 1), 10);
    return { id, ordinal, html: el.outerHTML, thumbnail: null };
  });

  // Extract all head content so iframe can inherit styles and fonts
  const headHtml = doc.head.innerHTML;

  const meta: DeckMeta = {
    version: 1,
    title: doc.querySelector('title')?.textContent ?? undefined,
    slides: slides.map(({ id, ordinal }) => ({ id, ordinal })),
    assets: [],
  };

  return { meta, headHtml, slides };
}

// ─── Writing deck ─────────────────────────────────────────────────────────

export async function writeDeck(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  html: string,
  sourceFileName?: string,
): Promise<void> {
  // Safety guard: never overwrite the source file
  if (sourceFileName && fileName === sourceFileName) {
    throw new Error(`Refusing to overwrite source file "${sourceFileName}". Save target must differ from source.`);
  }

  // 1. Write backup first
  await writeBackup(dir, html);

  // 2. Write working copy
  const fh = await dir.getFileHandle(fileName, { create: true });
  const writable = await fh.createWritable();
  await writable.write(html);
  await writable.close();
}

/** Write a timestamped backup snapshot into `.hds-backup/` (folder mode). */
export async function writeBackup(dir: FileSystemDirectoryHandle, html: string): Promise<void> {
  let backupDir: FileSystemDirectoryHandle;
  try {
    backupDir = await dir.getDirectoryHandle(BACKUP_DIR, { create: true });
  } catch {
    return; // silently skip if can't create backup dir
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const fh = await backupDir.getFileHandle(`${ts}.html`, { create: true });
  const writable = await fh.createWritable();
  await writable.write(html);
  await writable.close();

  await pruneBackups(backupDir);
}

async function pruneBackups(backupDir: FileSystemDirectoryHandle): Promise<void> {
  const names: string[] = [];
  for await (const [name] of backupDir as unknown as AsyncIterable<[string, FileSystemHandle]>) {
    if (name.endsWith('.html')) names.push(name);
  }
  names.sort(); // ISO timestamps sort lexicographically = chronologically
  while (names.length > MAX_BACKUPS) {
    const oldest = names.shift()!;
    await backupDir.removeEntry(oldest);
  }
}

// ─── Folder-mode backup listing (history drawer) ────────────────────────────

export interface BackupEntry {
  /** Backup file name, e.g. 2026-06-02T02-56-00-123Z.html */
  name: string;
  /** Epoch ms parsed from the file name. */
  ts: number;
  /** Byte size of the snapshot. */
  size: number;
}

/** Parse a backup file name (ISO with [:.]→-) back to epoch ms. */
function parseBackupTs(name: string): number {
  const base = name.replace(/\.html$/i, '');
  // 2026-06-02T02-56-00-123Z → 2026-06-02T02:56:00.123Z
  const m = base.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/);
  if (!m) return 0;
  const iso = `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

export async function listBackups(dir: FileSystemDirectoryHandle): Promise<BackupEntry[]> {
  let backupDir: FileSystemDirectoryHandle;
  try {
    backupDir = await dir.getDirectoryHandle(BACKUP_DIR);
  } catch {
    return [];
  }
  const entries: BackupEntry[] = [];
  for await (const [name, entry] of backupDir as unknown as AsyncIterable<[string, FileSystemHandle]>) {
    if (entry.kind !== 'file' || !name.endsWith('.html')) continue;
    const file = await (entry as FileSystemFileHandle).getFile();
    entries.push({ name, ts: parseBackupTs(name), size: file.size });
  }
  entries.sort((a, b) => b.ts - a.ts); // newest first
  return entries;
}

export async function readBackup(dir: FileSystemDirectoryHandle, name: string): Promise<string> {
  const backupDir = await dir.getDirectoryHandle(BACKUP_DIR);
  const fh = await backupDir.getFileHandle(name);
  const file = await fh.getFile();
  return file.text();
}

export async function deleteBackup(dir: FileSystemDirectoryHandle, name: string): Promise<void> {
  const backupDir = await dir.getDirectoryHandle(BACKUP_DIR);
  await backupDir.removeEntry(name);
}

// ─── Asset write ──────────────────────────────────────────────────────────

export async function writeAsset(
  dir: FileSystemDirectoryHandle,
  file: File,
): Promise<string> {
  let assetsDir: FileSystemDirectoryHandle;
  try {
    assetsDir = await dir.getDirectoryHandle('assets', { create: true });
  } catch {
    assetsDir = dir;
  }

  let name = file.name;
  let attempt = 0;
  while (attempt < 100) {
    try {
      await assetsDir.getFileHandle(name);
      // exists – try with suffix
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const base = file.name.slice(0, file.name.length - ext.length);
      attempt++;
      name = `${base}-${attempt}${ext}`;
    } catch {
      break;
    }
  }

  const fh = await assetsDir.getFileHandle(name, { create: true });
  const writable = await fh.createWritable();
  await writable.write(await file.arrayBuffer());
  await writable.close();

  return `assets/${name}`;
}

// ─── Rebuild full deck HTML after slide edits ──────────────────────────────

export function rebuildDeckHtml(
  originalHtml: string,
  slides: Pick<SlideState, 'id' | 'html'>[],
): string {
  const doc = new DOMParser().parseFromString(originalHtml, 'text/html');
  const oldSections = Array.from(doc.querySelectorAll<HTMLElement>(SLIDE_SELECTOR));
  const first = oldSections[0];
  if (!first || !first.parentElement) return `<!doctype html>\n${doc.documentElement.outerHTML}`;
  const parent = first.parentElement;

  // Rebuild the slide list in order (handles add / remove / reorder).
  const newNodes: Element[] = [];
  for (const { html } of slides) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const node = tmp.firstElementChild;
    if (node) newNodes.push(node);
  }

  for (const node of newNodes) parent.insertBefore(node, first);
  oldSections.forEach((s) => s.remove());

  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

/**
 * Like rebuildDeckHtml but restores blob: URLs back to original relative paths.
 * Used for export so Puppeteer can resolve the actual files on disk.
 */
export function rebuildDeckHtmlForExport(
  originalHtml: string,
  slides: Pick<SlideState, 'id' | 'html'>[],
  blobToPath: Map<string, string>,
): string {
  // Rebuild with current edits
  let rebuilt = rebuildDeckHtml(originalHtml, slides);
  // Replace any blob: URLs with their original relative paths
  for (const [blobUrl, relPath] of blobToPath) {
    rebuilt = rebuilt.split(blobUrl).join(relPath);
  }
  return rebuilt;
}
