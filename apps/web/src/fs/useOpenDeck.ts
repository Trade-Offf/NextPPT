import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeckStore } from '../store/deckStore.js';
import { pickDirectory, pickFile, recallHandle, verifyPermission, findDeckFile, parseDeck } from './adapter.js';
import { resolveAssetsInHtml, revokeAssetCache } from './assetResolver.js';

export const DIR_API_SUPPORTED = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
export const FILE_API_SUPPORTED = typeof window !== 'undefined' && 'showOpenFilePicker' in window;
export const FS_API_SUPPORTED = DIR_API_SUPPORTED || FILE_API_SUPPORTED;

/** Surface the human-readable message (already localised for thrown Errors)
 *  without the `Error:` prefix that `String(err)` would add. */
function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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

  const openDeck = async (handle: FileSystemDirectoryHandle) => {
    setLoading(true);
    setError(null);
    setFormatError(false);
    try {
      const ok = await verifyPermission(handle);
      if (!ok) throw new Error(t('errors.needPermission'));

      const result = await findDeckFile(handle);
      if (!result) {
        setFormatError(true);
        throw new Error(t('errors.notFound'));
      }

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
      setError(errMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Single self-contained HTML file (no folder, no relative assets).
  const openSingleFile = (fileName: string, html: string) => {
    setError(null);
    setFormatError(false);
    const { meta, headHtml, slides } = parseDeck(html);
    if (!slides.length) {
      setFormatError(true);
      setError(t('errors.noSlides'));
      return;
    }
    revokeAssetCache();
    openFile(fileName, html, headHtml, meta, slides);
  };

  const handlePickFolder = async () => {
    if (!DIR_API_SUPPORTED) return;
    try {
      const handle = await pickDirectory();
      await openDeck(handle);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(errMessage(err));
    }
  };

  const handlePickFile = async () => {
    if (!FILE_API_SUPPORTED) return;
    try {
      const { fileName, html } = await pickFile();
      openSingleFile(fileName, html);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(errMessage(err));
    }
  };

  const loadSampleTemplate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/sample-deck.html');
      if (!res.ok) throw new Error(t('errors.sampleFailed'));
      openSingleFile('sample-deck.html', await res.text());
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
      await openDeck(handle);
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
        await openDeck(handle as FileSystemDirectoryHandle);
        return;
      }
      if (handle?.kind === 'file') {
        const file = await (handle as FileSystemFileHandle).getFile();
        if (!file.name.toLowerCase().endsWith('.html') && !file.name.toLowerCase().endsWith('.htm')) {
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
    loadSampleTemplate,
    handleDrop,
  };
}
