import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeckStore } from '../store/deckStore.js';
import { pickDirectory, pickFile, recallHandle, verifyPermission, findDeckFile, findAnyHtmlFile, parseDeck, parseDoc } from './adapter.js';
import { normalizeDeck } from './normalizeDeck.js';
import { resolveAssetsInHtml, revokeAssetCache } from './assetResolver.js';
import type { WorkspaceKind } from '@hds/protocol';

/**
 * Derive the parsed pages for a workspace kind from the original source HTML.
 * `deck` normalizes any already-paginated shape into `section.slide`; `doc`
 * keeps the whole document as one free-edit page.
 */
function deriveForKind(sourceHtml: string, kind: WorkspaceKind) {
  if (kind === 'doc') {
    const { meta, headHtml, slides } = parseDoc(sourceHtml);
    return { rawHtml: sourceHtml, meta, headHtml, slides };
  }
  const norm = normalizeDeck(sourceHtml);
  const rawHtml = norm.strategy === 'native' ? sourceHtml : norm.html;
  const { meta, headHtml, slides } = parseDeck(rawHtml);
  return { rawHtml, meta, headHtml, slides };
}

export const DIR_API_SUPPORTED = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
export const FILE_API_SUPPORTED = typeof window !== 'undefined' && 'showOpenFilePicker' in window;
export const FS_API_SUPPORTED = DIR_API_SUPPORTED || FILE_API_SUPPORTED;

/** Surface the human-readable message (already localised for thrown Errors)
 *  without the `Error:` prefix that `String(err)` would add. */
function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function scrollToOpenError() {
  requestAnimationFrame(() => {
    document.getElementById('hds-open-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

/**
 * Everything needed to turn a folder / single HTML file into a loaded deck.
 * Shared by the landing page and the guide page so the guide can funnel a
 * reader straight into the editor ("read → act" in one place).
 */
export function useOpenDeck() {
  const { t } = useTranslation('editor');
  const openDirectory = useDeckStore((s) => s.openDirectory);
  const openFile = useDeckStore((s) => s.openFile);
  const switchKindInStore = useDeckStore((s) => s.switchKind);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Resolve a folder's relative assets (img/svg/url) inside derived slide HTML.
  const resolveAgainstDir = async (
    handle: FileSystemDirectoryHandle,
    derived: ReturnType<typeof deriveForKind>,
  ) => {
    const slides = await Promise.all(
      derived.slides.map(async (slide) => ({ ...slide, html: await resolveAssetsInHtml(slide.html, handle) })),
    );
    const headHtml = await resolveAssetsInHtml(derived.headHtml, handle);
    return { ...derived, slides, headHtml };
  };

  // ── Auto-detecting openers ──────────────────────────────────────────────────
  // Imports open immediately with a sensible default kind (deck when pagination
  // is detected, else doc). Users switch deck/doc later inside the editor and
  // see the effect live — no upfront single-vs-multi prompt.

  const loadDir = async (handle: FileSystemDirectoryHandle, fileName: string, sourceHtml: string) => {
    const norm = normalizeDeck(sourceHtml);
    const detected = norm.confidence === 'high' ? norm.slideCount : 0;
    const kind: WorkspaceKind = detected >= 1 ? 'deck' : 'doc';
    revokeAssetCache();
    const d = await resolveAgainstDir(handle, deriveForKind(sourceHtml, kind));
    openDirectory(handle, fileName, d.rawHtml, d.headHtml, d.meta, d.slides, kind, sourceHtml, detected);
  };

  const openDir = async (handle: FileSystemDirectoryHandle) => {
    setLoading(true);
    setError(null);
    try {
      const ok = await verifyPermission(handle);
      if (!ok) throw new Error(t('errors.needPermission'));

      const deckFile = await findDeckFile(handle);
      const picked = deckFile ?? (await findAnyHtmlFile(handle));
      if (!picked) throw new Error(t('errors.noHtml'));
      await loadDir(handle, picked.fileName, picked.html);
    } catch (err) {
      setError(errMessage(err));
      scrollToOpenError();
    } finally {
      setLoading(false);
    }
  };

  const openSingleFile = (fileName: string, sourceHtml: string) => {
    setError(null);
    const norm = normalizeDeck(sourceHtml);
    const detected = norm.confidence === 'high' ? norm.slideCount : 0;
    const kind: WorkspaceKind = detected >= 1 ? 'deck' : 'doc';
    const d = deriveForKind(sourceHtml, kind);
    revokeAssetCache();
    openFile(fileName, d.rawHtml, d.headHtml, d.meta, d.slides, kind, sourceHtml, detected);
  };

  /**
   * Switch the open workspace between deck (per-page) and doc (whole-page),
   * re-deriving pages from the untouched source. Keeps file handles; discards
   * unsaved edits (the caller confirms first when the deck is dirty).
   */
  const switchWorkspaceKind = async (target: WorkspaceKind) => {
    const st = useDeckStore.getState();
    if (!st.sourceHtml || st.kind === target) return;
    setLoading(true);
    setError(null);
    try {
      if (st.mode === 'folder' && st.dirHandle) {
        const d = await resolveAgainstDir(st.dirHandle, deriveForKind(st.sourceHtml, target));
        switchKindInStore(target, d.rawHtml, d.headHtml, d.meta, d.slides);
      } else {
        const d = deriveForKind(st.sourceHtml, target);
        switchKindInStore(target, d.rawHtml, d.headHtml, d.meta, d.slides);
      }
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePickFolder = async () => {
    if (!DIR_API_SUPPORTED) return;
    try {
      await openDir(await pickDirectory());
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(errMessage(err));
    }
  };

  const handlePickFile = async () => {
    if (!FILE_API_SUPPORTED) return;
    try {
      const { fileName, html } = await pickFile();
      if (!/\.html?$/i.test(fileName)) {
        setError(t('errors.dropHtmlOnly'));
        return;
      }
      openSingleFile(fileName, html);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(errMessage(err));
    }
  };

  /**
   * Open a ready-made marketplace sample (a public HTML URL) directly in the
   * editor. The workspace kind is auto-detected from the HTML. Caller navigates
   * home afterwards.
   */
  const openTemplateSample = async (url: string, fileName: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(t('errors.sampleFailed'));
      openSingleFile(fileName, await res.text());
      return true;
    } catch (err) {
      setError(errMessage(err));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleRecall = async () => {
    try {
      const handle = await recallHandle();
      if (!handle) return;
      await openDir(handle);
    } catch (err) {
      setError(errMessage(err));
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
        await openDir(handle as FileSystemDirectoryHandle);
        return;
      }
      if (handle?.kind === 'file') {
        const file = await (handle as FileSystemFileHandle).getFile();
        if (!/\.html?$/i.test(file.name)) {
          setError(t('errors.dropHtmlOnly'));
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
      setError(t('errors.dropHtmlOnly'));
    } catch (err) {
      setError(errMessage(err));
    }
  };

  return {
    loading,
    error,
    dragOver,
    setDragOver,
    switchWorkspaceKind,
    handlePickFolder,
    handlePickFile,
    handleRecall,
    openTemplateSample,
    handleDrop,
  };
}
