import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeckStore } from '../store/deckStore.js';
import { pickDirectory, pickFile, recallHandle, verifyPermission, findDeckFile, findAnyHtmlFile, deckSlideCount, parseDeck, parseDoc } from './adapter.js';
import { resolveAssetsInHtml, revokeAssetCache } from './assetResolver.js';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** True when the failure was a missing/invalid `section.slide` (drives the
   *  landing page's format-recovery hint, locale-independently). */
  const [formatError, setFormatError] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // ── Loaders (workspace kind already decided) ────────────────────────────────
  // `deck` parses `section.slide` pages; `doc` wraps the whole body as one
  // free-edit page. Both resolve relative assets against the folder handle.

  const loadDir = async (
    handle: FileSystemDirectoryHandle,
    fileName: string,
    html: string,
    kind: 'deck' | 'doc',
  ) => {
    const { meta, headHtml: rawHead, slides: rawSlides } = kind === 'deck' ? parseDeck(html) : parseDoc(html);
    revokeAssetCache();
    const resolvedSlides = await Promise.all(
      rawSlides.map(async (slide) => ({
        ...slide,
        html: await resolveAssetsInHtml(slide.html, handle),
      })),
    );
    const headHtml = await resolveAssetsInHtml(rawHead, handle);
    openDirectory(handle, fileName, html, headHtml, meta, resolvedSlides, kind);
  };

  const loadSingle = (fileName: string, html: string, kind: 'deck' | 'doc') => {
    const { meta, headHtml, slides } = kind === 'deck' ? parseDeck(html) : parseDoc(html);
    revokeAssetCache();
    openFile(fileName, html, headHtml, meta, slides, kind);
  };

  // ── Auto-detecting openers ──────────────────────────────────────────────────
  // The workspace kind is inferred from the HTML itself: a `section.slide` deck
  // opens in PPT mode; anything else opens in free-edit (doc) mode. There is no
  // manual switch — whatever you drop in is recognised automatically.

  const openDir = async (handle: FileSystemDirectoryHandle) => {
    setLoading(true);
    setError(null);
    setFormatError(false);
    try {
      const ok = await verifyPermission(handle);
      if (!ok) throw new Error(t('errors.needPermission'));

      const deckFile = await findDeckFile(handle);
      if (deckFile) {
        await loadDir(handle, deckFile.fileName, deckFile.html, 'deck');
        return;
      }
      const anyFile = await findAnyHtmlFile(handle);
      if (!anyFile) throw new Error(t('errors.noHtml'));
      await loadDir(handle, anyFile.fileName, anyFile.html, 'doc');
    } catch (err) {
      setError(errMessage(err));
      scrollToOpenError();
    } finally {
      setLoading(false);
    }
  };

  const openSingleFile = (fileName: string, html: string) => {
    setError(null);
    setFormatError(false);
    loadSingle(fileName, html, deckSlideCount(html) > 0 ? 'deck' : 'doc');
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
  const openTemplateSample = async (url: string, fileName: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(t('errors.sampleFailed'));
      openSingleFile(fileName, await res.text());
    } catch (err) {
      setError(errMessage(err));
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
    formatError,
    dragOver,
    setDragOver,
    handlePickFolder,
    handlePickFile,
    handleRecall,
    openTemplateSample,
    handleDrop,
  };
}
