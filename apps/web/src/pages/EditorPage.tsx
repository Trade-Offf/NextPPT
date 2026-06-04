import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useDeckStore } from '../store/deckStore.js';
import { useGuideNav } from '../hooks/useGuideNav.js';
import { LanguageSwitcher } from '../components/LanguageSwitcher.js';
import { ScaledCanvas, type CanvasHandle } from '../components/CanvasFrame.js';
import { SlideListPane } from '../components/SlideListPane.js';
import { PropertyPane } from '../components/PropertyPane.js';
import { CodeEditorPane } from '../components/CodeEditorPane.js';
import { ExportDrawer } from '../components/ExportDrawer.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { HistoryDrawer } from '../components/HistoryDrawer.js';
import type { PatchOp, RuntimeMessage } from '@hds/protocol';
import { writeDeck, rebuildDeckHtmlForExport, writeAsset, saveAsNewFile, writeFileHandle, parseDeck } from '../fs/adapter.js';
import type { HistoryCtx } from '../fs/history.js';
import { recordSnapshot, listSnapshots } from '../fs/history.js';
import { registerBlobPath, getBlobToPathMap, resolveAssetsInHtml, revokeAssetCache } from '../fs/assetResolver.js';
import { ulid } from '../lib/ulid.js';

const SLIDE_W = 1280;
const SLIDE_H = 720;
const DEFAULT_INSERT_WIDTH_RATIO = 0.36; // newly dropped images span ~36% of the slide width

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 1, height: 1 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export function EditorPage() {
  const { t } = useTranslation('editor');
  const { openGuide } = useGuideNav();
  const slides = useDeckStore((s) => s.slides);
  const currentSlideId = useDeckStore((s) => s.currentSlideId);
  const dirHandle = useDeckStore((s) => s.dirHandle);
  const fileHandle = useDeckStore((s) => s.fileHandle);
  const mode = useDeckStore((s) => s.mode);
  const setWorkingFileHandle = useDeckStore((s) => s.setWorkingFileHandle);
  const deckFileName = useDeckStore((s) => s.deckFileName);
  const rawHtml = useDeckStore((s) => s.rawHtml);
  const headHtml = useDeckStore((s) => s.headHtml);
  const sourceFileName = useDeckStore((s) => s.sourceFileName);
  const isDirty = useDeckStore((s) => s.isDirty);
  const isSaving = useDeckStore((s) => s.isSaving);
  const lastSavedAt = useDeckStore((s) => s.lastSavedAt);
  const viewMode = useDeckStore((s) => s.viewMode);
  const setViewMode = useDeckStore((s) => s.setViewMode);
  const updateSlideHtml = useDeckStore((s) => s.updateSlideHtml);
  const setRawHtml = useDeckStore((s) => s.setRawHtml);
  const markDirty = useDeckStore((s) => s.markDirty);
  const markSaving = useDeckStore((s) => s.markSaving);
  const markSaved = useDeckStore((s) => s.markSaved);
  const applyRestoredDeck = useDeckStore((s) => s.applyRestoredDeck);
  const undo = useDeckStore((s) => s.undo);
  const redo = useDeckStore((s) => s.redo);
  const canUndo = useDeckStore((s) => s.past.length > 0);
  const canRedo = useDeckStore((s) => s.future.length > 0);
  const closeDirectory = useDeckStore((s) => s.closeDirectory);

  const selection = useDeckStore((s) => s.selection);

  const [exportOpen, setExportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [leaveHomePromptOpen, setLeaveHomePromptOpen] = useState(false);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [firstSavePromptOpen, setFirstSavePromptOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  // Canvas interaction mode. 'edit' = safe content editing (select + double-click
  // text + property panel). 'drag' = freeform move/resize/delete. Strictly
  // exclusive so users don't accidentally move things while editing.
  const [interactionMode, setInteractionMode] = useState<'edit' | 'drag'>('edit');

  // Stable history context for the drawer / snapshot calls.
  const historyCtx = useMemo<HistoryCtx>(
    () => (dirHandle
      ? { mode: 'folder', dir: dirHandle }
      : { mode: 'file', deck: sourceFileName, fileName: deckFileName }),
    [dirHandle, sourceFileName, deckFileName],
  );
  const [containerSize, setContainerSize] = useState({ w: 800, h: 450 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasCardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<CanvasHandle>(null);

  const currentSlide = slides.find((s) => s.id === currentSlideId);

  // Measure the available canvas area (width AND height) so the slide fits the
  // full-bleed stage completely. The observer re-fires automatically when the
  // floating inspector toggles (it changes <main>'s right inset → resize).
  useEffect(() => {
    if (viewMode !== 'visual' || !canvasContainerRef.current) return;
    const el = canvasContainerRef.current;
    const measure = () => setContainerSize({ w: Math.floor(el.clientWidth), h: Math.floor(el.clientHeight) });
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode]);

  // Fit the 16:9 slide within the measured area by the tighter dimension.
  const fitWidth = Math.max(0, Math.min(containerSize.w, Math.round((containerSize.h * 1280) / 720)));

  const showInspector = viewMode === 'visual' && !!selection && inspectorOpen;

  // Replacing slide HTML reloads the srcdoc iframe, which clears the in-iframe
  // selection overlay/handles. Track the live selector and restore it once the
  // reloaded runtime reports `ready`, so a selected (e.g. just-inserted) image
  // keeps its handles instead of needing a manual re-click.
  const lastSelectorRef = useRef<string | null>(null);
  const pendingReselectRef = useRef<{ slideId: string; selector: string } | null>(null);

  // ── Live iframe (Phase 0) ──────────────────────────────────────────────────
  // The canvas iframe is the live source of truth: edits made inside it (move,
  // resize, text, patches) must NOT reload it. We only remount (via `canvasKey`)
  // when the slide HTML changes for an EXTERNAL reason — undo/redo, snapshot
  // restore, or switching slides — never for our own `patched` echo.
  const lastPatchedHtmlRef = useRef<string | null>(null);
  const prevHtmlRef = useRef<string | undefined>(undefined);
  const prevSlideIdRef = useRef<string | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);

  // Mirror the mode into a ref so `handleMessage` (and the post-remount `ready`
  // handler) always reads the latest value without re-subscribing.
  const interactionModeRef = useRef(interactionMode);
  interactionModeRef.current = interactionMode;

  // Handle runtime messages from iframe
  const handleMessage = useCallback((msg: RuntimeMessage) => {
    if (msg.type === 'select') lastSelectorRef.current = msg.selector;
    if (msg.type === 'clear-select') lastSelectorRef.current = null;
    // When iframe applies a patch, update store so re-render keeps the change.
    if (msg.type === 'patched' && currentSlideId) {
      if (lastSelectorRef.current) {
        pendingReselectRef.current = { slideId: currentSlideId, selector: lastSelectorRef.current };
      }
      // Mark this html as self-originated so the diff effect won't remount.
      lastPatchedHtmlRef.current = msg.html;
      updateSlideHtml(currentSlideId, msg.html);
    }
    // After an external remount the runtime re-reports `ready`; re-sync the mode
    // (it defaults to 'edit' on a fresh runtime) and restore the prior selection.
    if (msg.type === 'ready') {
      canvasRef.current?.sendMessage({ type: 'set-mode', mode: interactionModeRef.current });
      const pending = pendingReselectRef.current;
      pendingReselectRef.current = null;
      if (pending && pending.slideId === currentSlideId) {
        canvasRef.current?.sendMessage({ type: 'select-element', selector: pending.selector });
      }
    }
  }, [currentSlideId, updateSlideHtml]);

  // Push mode changes to the live iframe.
  useEffect(() => {
    canvasRef.current?.sendMessage({ type: 'set-mode', mode: interactionMode });
  }, [interactionMode]);

  // Remount the iframe only on external, same-slide HTML changes (undo/redo,
  // restore). Slide switches are handled by `currentSlideId` in the key; our own
  // `patched` echoes are skipped because the live iframe already reflects them.
  useEffect(() => {
    const html = currentSlide?.html;
    if (prevSlideIdRef.current !== currentSlideId) {
      prevSlideIdRef.current = currentSlideId ?? null;
      prevHtmlRef.current = html;
      return;
    }
    if (html !== prevHtmlRef.current) {
      prevHtmlRef.current = html;
      if (html !== lastPatchedHtmlRef.current) setCanvasKey((k) => k + 1);
    }
  }, [currentSlideId, currentSlide?.html]);

  // Switching slides remounts the runtime; drop any stale selection state.
  useEffect(() => {
    lastSelectorRef.current = null;
    pendingReselectRef.current = null;
  }, [currentSlideId]);

  // Forward patch from PropertyPane into the iframe
  const handlePatch = useCallback(
    (selector: string, ops: PatchOp[]) => {
      canvasRef.current?.sendMessage({ type: 'patch', selector, ops });
    },
    [],
  );

  // Delete the selected element (inserted image) from inside the iframe.
  const handleDeleteElement = useCallback((selector: string) => {
    canvasRef.current?.sendMessage({ type: 'delete-element', selector });
  }, []);

  // Save to disk. Folder mode → writeDeck (+ .hds-backup). File mode → write
  // to the working file handle (acquired on first save).
  const handleSave = useCallback(async () => {
    if (!dirHandle && !fileHandle && deckFileName === '') return;
    // First save in single-file mode: explain the copy behaviour first, then
    // let the user trigger the native picker from a fresh gesture (the modal
    // button click). Bail before markSaving so status stays "unsaved".
    if (!dirHandle && !fileHandle) {
      setFirstSavePromptOpen(true);
      return;
    }
    markSaving();
    // Restore blob: URLs (inserted/replaced images) back to on-disk relative
    // paths so the saved file reloads correctly in a later session.
    const rebuilt = rebuildDeckHtmlForExport(rawHtml, slides, getBlobToPathMap());
    setRawHtml(rebuilt);
    try {
      if (dirHandle) {
        await writeDeck(dirHandle, deckFileName, rebuilt, sourceFileName);
      } else if (fileHandle) {
        await writeFileHandle(fileHandle, rebuilt);
        await recordSnapshot({ mode: 'file', deck: sourceFileName, fileName: deckFileName }, rebuilt);
      }
      markSaved();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error('save failed', err);
      markDirty();
    }
  }, [dirHandle, fileHandle, deckFileName, rawHtml, slides, sourceFileName, markSaving, setRawHtml, markSaved, markDirty]);

  // Single-file first save: confirmed from the explanation dialog. The button
  // click is a fresh user gesture, satisfying showSaveFilePicker's requirement.
  const confirmFirstSave = useCallback(async () => {
    setFirstSavePromptOpen(false);
    markSaving();
    const rebuilt = rebuildDeckHtmlForExport(rawHtml, slides, getBlobToPathMap());
    setRawHtml(rebuilt);
    try {
      const fh = await saveAsNewFile(deckFileName, rebuilt);
      setWorkingFileHandle(fh);
      await recordSnapshot({ mode: 'file', deck: sourceFileName, fileName: deckFileName }, rebuilt);
      markSaved();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error('save failed', err);
      markDirty();
    }
  }, [deckFileName, rawHtml, slides, sourceFileName, setWorkingFileHandle, markSaving, setRawHtml, markSaved, markDirty]);

  // Restore a snapshot: record current content first (so restore is reversible),
  // then parse + resolve assets and apply. The resulting dirty state auto-saves.
  const handleRestore = useCallback(async (snapshotHtml: string) => {
    try {
      const current = rebuildDeckHtmlForExport(rawHtml, slides, getBlobToPathMap());
      await recordSnapshot(historyCtx, current);
    } catch (err) {
      console.error('snapshot-before-restore failed', err);
    }
    const { meta, headHtml: rawHead, slides: rawSlides } = parseDeck(snapshotHtml);
    let resolvedSlides = rawSlides;
    let resolvedHead = rawHead;
    if (dirHandle) {
      resolvedSlides = await Promise.all(
        rawSlides.map(async (sl) => ({ ...sl, html: await resolveAssetsInHtml(sl.html, dirHandle) })),
      );
      resolvedHead = await resolveAssetsInHtml(rawHead, dirHandle);
    }
    applyRestoredDeck(snapshotHtml, resolvedHead, meta, resolvedSlides);
  }, [rawHtml, slides, dirHandle, historyCtx, applyRestoredDeck]);

  // Return to the landing page. Confirm first if there are unsaved changes;
  // closeDirectory() clears slides so HomeRoute falls back to LandingPage.
  const doLeaveHome = useCallback(() => {
    setLeaveHomePromptOpen(false);
    revokeAssetCache();
    closeDirectory();
  }, [closeDirectory]);

  const requestLeaveHome = useCallback(() => {
    if (isDirty) setLeaveHomePromptOpen(true);
    else doLeaveHome();
  }, [isDirty, doLeaveHome]);

  // Keep the history-button enabled state fresh (mount, after save, on toggle).
  useEffect(() => {
    let cancelled = false;
    void listSnapshots(historyCtx)
      .then((l) => { if (!cancelled) setSnapshotCount(l.length); })
      .catch(() => { if (!cancelled) setSnapshotCount(0); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirHandle, sourceFileName, deckFileName, lastSavedAt, historyOpen]);

  // Auto-save: debounce 1.5s after the last edit (F-11). Only runs once a
  // writable target exists — single-file mode needs a manual first save.
  useEffect(() => {
    if (!isDirty || isSaving || (!dirHandle && !fileHandle)) return;
    const t = setTimeout(() => { void handleSave(); }, 1500);
    return () => clearTimeout(t);
  }, [slides, isDirty, isSaving, dirHandle, fileHandle, handleSave]);

  // Keyboard save shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty) void handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDirty, handleSave]);

  // Undo / redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Cmd/Ctrl+Y). Skipped in code mode
  // and while a text field is focused (let native / Monaco undo handle those).
  // Inline contenteditable lives inside the iframe, whose keydowns never reach
  // this window listener, so it is naturally unaffected.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      const isUndo = k === 'z' && !e.shiftKey;
      const isRedo = (k === 'z' && e.shiftKey) || k === 'y';
      if (!isUndo && !isRedo) return;
      if (viewMode === 'code') return;
      const ae = document.activeElement as HTMLElement | null;
      const tag = ae?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ae?.isContentEditable) return;
      e.preventDefault();
      if (isRedo) redo(); else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewMode, undo, redo]);

  // Persist an image file and return a `src` usable inside the iframe.
  // Folder mode: write to assets/ and register the blob→path map so export can
  // restore the on-disk relative path (the same blob URL must be the one shown).
  // File mode: inline as a base64 data URI so the single HTML stays self-contained.
  const persistImageFile = useCallback(
    async (file: File, existingBlobUrl?: string): Promise<string> => {
      if (dirHandle) {
        const blobUrl = existingBlobUrl ?? URL.createObjectURL(file);
        const relativePath = await writeAsset(dirHandle, file);
        registerBlobPath(relativePath, blobUrl);
        return blobUrl;
      }
      return fileToDataUrl(file);
    },
    [dirHandle],
  );

  // Handle image replacement from PropertyPane (F-08). The preview blob URL was
  // already patched in by PropertyPane; folder mode just persists + registers it,
  // file mode swaps in the self-contained data URI and frees the preview blob.
  useEffect(() => {
    const handler = async (e: Event) => {
      const { file, blobUrl, selector } = (e as CustomEvent<{ file: File; blobUrl: string; selector: string }>).detail;
      try {
        const src = await persistImageFile(file, blobUrl);
        if (!dirHandle) {
          canvasRef.current?.sendMessage({ type: 'patch', selector, ops: [{ kind: 'attr', name: 'src', value: src }] });
          URL.revokeObjectURL(blobUrl);
        }
      } catch (err) {
        console.error('image replace failed', err);
      }
    };
    window.addEventListener('hds-replace-image', handler as EventListener);
    return () => window.removeEventListener('hds-replace-image', handler as EventListener);
  }, [dirHandle, persistImageFile]);

  // Drop an image file onto the canvas → insert it as a freely-transformable,
  // percentage-positioned <img>. Coordinates are converted from client px to
  // slide % exactly once here (the iframe works in native 1280×720 space after).
  const handleDropImage = useCallback(
    async (file: File, clientX: number, clientY: number) => {
      const card = canvasCardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      if (rect.width === 0) return;
      const scale = rect.width / SLIDE_W;

      const { width: natW, height: natH } = await loadImageSize(file);
      const aspect = natW / Math.max(1, natH);
      let widthPx = SLIDE_W * DEFAULT_INSERT_WIDTH_RATIO;
      let heightPx = widthPx / aspect;
      if (heightPx > SLIDE_H * 0.9) {
        heightPx = SLIDE_H * 0.9;
        widthPx = heightPx * aspect;
      }

      // Center the image on the drop point, then clamp fully inside the slide.
      const dropX = (clientX - rect.left) / scale;
      const dropY = (clientY - rect.top) / scale;
      const leftPx = Math.max(0, Math.min(SLIDE_W - widthPx, dropX - widthPx / 2));
      const topPx = Math.max(0, Math.min(SLIDE_H - heightPx, dropY - heightPx / 2));

      try {
        const src = await persistImageFile(file);
        // Inserting an image is a freeform action: switch to drag mode so the
        // user can immediately position/resize it. Send set-mode BEFORE insert so
        // the runtime is already in drag mode when it selects (handles show, and
        // the idempotent set-mode from the effect won't deselect it afterwards).
        setInteractionMode('drag');
        canvasRef.current?.sendMessage({ type: 'set-mode', mode: 'drag' });
        canvasRef.current?.sendMessage({
          type: 'insert-image',
          id: ulid(),
          src,
          leftPct: (leftPx / SLIDE_W) * 100,
          topPct: (topPx / SLIDE_H) * 100,
          widthPct: (widthPx / SLIDE_W) * 100,
        });
      } catch (err) {
        console.error('image insert failed', err);
      }
    },
    [persistImageFile],
  );

  // Window-level drag tracking activates the drop overlay (the sandboxed iframe
  // would otherwise swallow drag events over the slide). Counter handles nested
  // dragenter/leave firing across child elements.
  useEffect(() => {
    if (viewMode !== 'visual') return;
    let depth = 0;
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.items ?? []).some((i) => i.kind === 'file');
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragActive(true);
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragActive(false);
    };
    // Prevent the browser from navigating to / opening a file dropped anywhere
    // outside the canvas overlay (default behaviour would unload the app).
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
      depth = 0;
      setDragActive(false);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [viewMode]);

  if (!currentSlide) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--silver)]">
        {t('page.noSlide')}
      </div>
    );
  }

  // Assets are served through /v1/asset?path=... proxy (avoids file:// null-origin restriction)
  // The proxy is only available when the API is running; fallback to empty base otherwise.
  const assetsBaseUrl = '/v1/asset-base/';

  return (
    <div className="relative h-full hds-stage overflow-hidden">
      {/* ── Floating chrome ─────────────────────────────────────── */}
      {/* Top-left: sidebar toggle + filename + save status */}
      <div className="absolute top-4 left-4 z-20 hds-floating-bar">
        <button
          onClick={requestLeaveHome}
          className="w-7 h-7 rounded-lg overflow-hidden shrink-0 shadow-sm hover:brightness-110 transition"
          aria-label={t('page.backHome')}
          title={t('page.backHome')}
        >
          <img src="/icon-192.png" alt="NextPPT" className="w-full h-full" />
        </button>
        <span className="w-px h-4 bg-white/15 shrink-0" />
        <button
          onClick={() => setRailOpen((v) => !v)}
          className={`hds-bar-icon ${railOpen ? 'is-active' : ''}`}
          aria-label={railOpen ? t('page.collapseRail') : t('page.expandRail')}
          title={railOpen ? t('page.collapseRail') : t('page.expandRail')}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
            <path d="M7.5 3.5v13" />
          </svg>
        </button>
        <span className="text-[13px] font-semibold truncate max-w-[200px] px-1">{deckFileName}</span>
        <span className="text-[11px] shrink-0 select-none" title={lastSavedAt ? t('status.lastSaved', { time: new Date(lastSavedAt).toLocaleTimeString() }) : sourceFileName}>
          {isSaving ? (
            <span className="text-white/55">{t('status.saving')}</span>
          ) : isDirty ? (
            mode === 'file' && !fileHandle
              ? <span className="text-amber-300">{t('status.unsavedCopy')}</span>
              : <span className="text-amber-300">{t('status.unsaved')}</span>
          ) : lastSavedAt ? (
            <span className="text-emerald-300">{t('status.saved')}</span>
          ) : null}
        </span>

        {/* Copy mental-model hint: original file is never touched */}
        <div className="relative group shrink-0">
          <button className="hds-bar-icon" aria-label={t('saveHint.title')} title={t('saveHint.title')}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="10" cy="10" r="7.5" />
              <path d="M10 9v4" strokeLinecap="round" />
              <circle cx="10" cy="6.4" r="0.4" fill="currentColor" stroke="none" />
            </svg>
          </button>
          <div className="hidden group-hover:block absolute left-0 top-full mt-2 w-64 p-3 rounded-xl text-[11px] leading-relaxed z-30 bg-[rgba(24,25,29,0.96)] border border-white/12 text-white/75 shadow-2xl">
            <p className="text-white/90 font-medium mb-1.5">{t('saveHint.originalUntouched')}</p>
            <p>
              <Trans
                t={t}
                i18nKey="saveHint.sourceKept"
                values={{ name: sourceFileName }}
                components={{ file: <span className="text-white/90 font-mono" /> }}
              />
            </p>
            <p className="mt-1 text-emerald-300 font-mono break-all">{deckFileName}</p>
          </div>
        </div>

        <span className="w-px h-4 bg-white/15 shrink-0" />
        <button
          onClick={() => undo()}
          disabled={!canUndo}
          className="hds-bar-icon disabled:opacity-30"
          aria-label={t('page.undo')}
          title={t('page.undoTitle')}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M7 6L3.5 9.5 7 13" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.5 9.5H12a4.5 4.5 0 0 1 0 9h-2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={() => redo()}
          disabled={!canRedo}
          className="hds-bar-icon disabled:opacity-30"
          aria-label={t('page.redo')}
          title={t('page.redoTitle')}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M13 6l3.5 3.5L13 13" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16.5 9.5H8a4.5 4.5 0 0 0 0 9h2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Top-center: primary interaction-mode pill (edit / drag). Hidden in code mode. */}
      {viewMode === 'visual' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 hds-floating-bar">
          <div className="hds-segmented" role="tablist">
            <button
              role="tab"
              aria-selected={interactionMode === 'edit'}
              className={`hds-segment ${interactionMode === 'edit' ? 'is-active' : ''}`}
              onClick={() => setInteractionMode('edit')}
            >
              {t('page.modeEdit')}
            </button>
            <button
              role="tab"
              aria-selected={interactionMode === 'drag'}
              className={`hds-segment ${interactionMode === 'drag' ? 'is-active' : ''}`}
              onClick={() => setInteractionMode('drag')}
            >
              {t('page.modeDrag')}
            </button>
          </div>
        </div>
      )}

      {/* Top-right: code toggle (de-emphasized) + inspector + save + export */}
      <div className="absolute top-4 right-4 z-20 hds-floating-bar">
        <button
          onClick={() => setViewMode(viewMode === 'code' ? 'visual' : 'code')}
          className={`hds-bar-icon ${viewMode === 'code' ? 'is-active' : ''}`}
          aria-label={t('page.viewCode')}
          title={t('page.viewCode')}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.5 6.5 4 10l3.5 3.5M12.5 6.5 16 10l-3.5 3.5" />
          </svg>
        </button>
        <span className="w-px h-4 bg-white/15 shrink-0" />
        <button
          onClick={() => setInspectorOpen((v) => !v)}
          className={`hds-bar-icon ${inspectorOpen ? 'is-active' : ''}`}
          aria-label={inspectorOpen ? t('page.collapseInspector') : t('page.expandInspector')}
          title={selection ? (inspectorOpen ? t('page.collapseInspector') : t('page.expandInspector')) : t('page.inspectorDisabled')}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
            <path d="M12.5 3.5v13" />
          </svg>
        </button>
        <button
          onClick={() => setHistoryOpen(true)}
          disabled={snapshotCount === 0}
          className="hds-bar-icon disabled:opacity-30"
          aria-label={t('page.history')}
          title={snapshotCount === 0 ? t('page.historyDisabled') : t('page.history')}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M10 5.5V10l3 1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.2 10a6.8 6.8 0 1 0 2-4.8M3.2 4.2v2.4h2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button onClick={() => void handleSave()} disabled={!isDirty} className="hds-bar-btn">
          {t('page.save')}
        </button>
        <button onClick={() => setExportOpen(true)} className="hds-btn-primary px-4 py-1.5 text-xs rounded-full">
          {t('page.export')}
        </button>
        <button
          onClick={() => openGuide('export')}
          className="hds-bar-icon"
          aria-label={t('page.guide')}
          title={t('page.guide')}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="10" cy="10" r="7.5" />
            <path d="M8 7.6a2 2 0 1 1 2.6 1.9c-.5.2-.9.6-.9 1.2v.4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10" cy="14" r="0.4" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <span className="w-px h-4 bg-white/15 shrink-0" />
        <LanguageSwitcher />
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      {viewMode === 'code' ? (
        <div className="absolute inset-0 pt-20 px-3 pb-3 flex">
          <CodeEditorPane key={currentSlideId} />
        </div>
      ) : (
        <>
          {/* Floating thumbnail rail (collapsible) */}
          {railOpen && (
            <div className="absolute left-3 top-20 bottom-3 z-10">
              <SlideListPane floating />
            </div>
          )}

          {/* Full-bleed canvas area (insets leave room for floating chrome) */}
          <main
            ref={canvasContainerRef}
            className="absolute flex items-center justify-center canvas-host transition-[left,right] duration-200 ease-out"
            style={{ top: 80, bottom: 16, left: railOpen ? 224 : 16, right: showInspector ? 328 : 16 }}
          >
            <div ref={canvasCardRef} className="hds-canvas-card overflow-hidden relative">
              <ScaledCanvas
                key={`${currentSlideId}:${canvasKey}`}
                ref={canvasRef}
                sectionHtml={currentSlide.html}
                headHtml={headHtml}
                assetsBaseUrl={assetsBaseUrl}
                containerWidth={fitWidth}
                onMessage={handleMessage}
              />
              {dragActive && (
                <div
                  className="hds-drop-overlay"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
                    if (file) void handleDropImage(file, e.clientX, e.clientY);
                  }}
                >
                  <span className="hds-drop-hint">{t('imageDrop.hint')}</span>
                </div>
              )}
            </div>
          </main>

          {/* On-demand floating inspector — mounts only when selected and opened */}
          {showInspector && (
            <div className="absolute right-3 top-20 bottom-3 z-10">
              <PropertyPane mode={interactionMode} onPatch={handlePatch} onDelete={handleDeleteElement} floating onClose={() => setInspectorOpen(false)} />
            </div>
          )}
        </>
      )}

      <ExportDrawer open={exportOpen} onClose={() => setExportOpen(false)} />

      <HistoryDrawer
        open={historyOpen}
        ctx={historyCtx}
        onClose={() => setHistoryOpen(false)}
        onRestore={handleRestore}
      />


      <ConfirmDialog
        open={leaveHomePromptOpen}
        title={t('leaveHome.title')}
        confirmLabel={t('leaveHome.confirm')}
        onConfirm={doLeaveHome}
        onCancel={() => setLeaveHomePromptOpen(false)}
        message={
          <>
            <p>{t('leaveHome.msg1')}</p>
            <p className="mt-2 text-[var(--tertiary-label)]">{t('leaveHome.msg2')}</p>
          </>
        }
      />

      <ConfirmDialog
        open={firstSavePromptOpen}
        title={t('firstSave.title')}
        confirmLabel={t('firstSave.confirm')}
        onConfirm={() => void confirmFirstSave()}
        onCancel={() => setFirstSavePromptOpen(false)}
        message={
          <>
            <p>{t('firstSave.msg1')}</p>
            <p className="mt-2">{t('firstSave.msg2')}</p>
            <p className="mt-1 font-mono text-[var(--label)] break-all">{deckFileName}</p>
            <p className="mt-2 text-[var(--tertiary-label)]">{t('firstSave.msg3')}</p>
          </>
        }
      />
    </div>
  );
}
