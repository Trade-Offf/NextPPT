import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useDeckStore } from '../store/deckStore.js';
import { ScaledCanvas, type CanvasHandle } from '../components/CanvasFrame.js';
import { SlideListPane } from '../components/SlideListPane.js';
import { PropertyPane } from '../components/PropertyPane.js';
import { CodeEditorPane } from '../components/CodeEditorPane.js';
import { ExportDrawer } from '../components/ExportDrawer.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { HistoryDrawer } from '../components/HistoryDrawer.js';
import type { PatchOp, RuntimeMessage } from '@hds/protocol';
import { writeDeck, rebuildDeckHtml, writeAsset, saveAsNewFile, writeFileHandle, parseDeck } from '../fs/adapter.js';
import type { HistoryCtx } from '../fs/history.js';
import { recordSnapshot, listSnapshots } from '../fs/history.js';
import { registerBlobPath, resolveAssetsInHtml, revokeAssetCache } from '../fs/assetResolver.js';

export function EditorPage() {
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
  const openGuide = useDeckStore((s) => s.openGuide);
  const closeDirectory = useDeckStore((s) => s.closeDirectory);

  const selection = useDeckStore((s) => s.selection);

  const [exportOpen, setExportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [leaveHomePromptOpen, setLeaveHomePromptOpen] = useState(false);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [firstSavePromptOpen, setFirstSavePromptOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  // Stable history context for the drawer / snapshot calls.
  const historyCtx = useMemo<HistoryCtx>(
    () => (dirHandle
      ? { mode: 'folder', dir: dirHandle }
      : { mode: 'file', deck: sourceFileName, fileName: deckFileName }),
    [dirHandle, sourceFileName, deckFileName],
  );
  const [containerSize, setContainerSize] = useState({ w: 800, h: 450 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
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

  // Handle runtime messages from iframe
  const handleMessage = useCallback((msg: RuntimeMessage) => {
    // When iframe applies a patch, update store so re-render keeps the change
    if (msg.type === 'patched' && currentSlideId) {
      updateSlideHtml(currentSlideId, msg.html);
    }
  }, [currentSlideId, updateSlideHtml]);

  // Forward patch from PropertyPane into the iframe
  const handlePatch = useCallback(
    (selector: string, ops: PatchOp[]) => {
      canvasRef.current?.sendMessage({ type: 'patch', selector, ops });
    },
    [],
  );

  // Save to disk. Folder mode → writeDeck (+ .hds-backup). File mode → write
  // to the working file handle (acquired on first save).
  const handleSave = useCallback(async () => {
    if (!dirHandle && !fileHandle && deckFileName === '') return;
    // First save in single-file mode: explain the copy behaviour first, then
    // let the user trigger the native picker from a fresh gesture (the modal
    // button click). Bail before markSaving so status stays "未保存".
    if (!dirHandle && !fileHandle) {
      setFirstSavePromptOpen(true);
      return;
    }
    markSaving();
    const rebuilt = rebuildDeckHtml(rawHtml, slides);
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
    const rebuilt = rebuildDeckHtml(rawHtml, slides);
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
      const current = rebuildDeckHtml(rawHtml, slides);
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
  // closeDirectory() clears slides so App falls back to LandingPage.
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

  // Handle image replacement from PropertyPane (F-08).
  // Folder mode: persist the file to assets/ and register the blob→path map so
  // export restores the on-disk relative path.
  // File mode (no folder): inline the new image as a base64 data URI so the
  // single HTML stays self-contained, then revoke the temporary blob URL.
  useEffect(() => {
    const handler = async (e: Event) => {
      const { file, blobUrl, selector } = (e as CustomEvent<{ file: File; blobUrl: string; selector: string }>).detail;
      try {
        if (dirHandle) {
          const relativePath = await writeAsset(dirHandle, file);
          registerBlobPath(relativePath, blobUrl);
          return;
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        canvasRef.current?.sendMessage({ type: 'patch', selector, ops: [{ kind: 'attr', name: 'src', value: dataUrl }] });
        URL.revokeObjectURL(blobUrl);
      } catch (err) {
        console.error('image replace failed', err);
      }
    };
    window.addEventListener('hds-replace-image', handler as EventListener);
    return () => window.removeEventListener('hds-replace-image', handler as EventListener);
  }, [dirHandle]);

  if (!currentSlide) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--silver)]">
        没有可编辑的幻灯片
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
          aria-label="返回首页"
          title="返回首页"
        >
          <img src="/icon-192.png" alt="NextPPT" className="w-full h-full" />
        </button>
        <span className="w-px h-4 bg-white/15 shrink-0" />
        <button
          onClick={() => setRailOpen((v) => !v)}
          className={`hds-bar-icon ${railOpen ? 'is-active' : ''}`}
          aria-label={railOpen ? '收起页面列表' : '展开页面列表'}
          title={railOpen ? '收起页面列表' : '展开页面列表'}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
            <path d="M7.5 3.5v13" />
          </svg>
        </button>
        <span className="text-[13px] font-semibold truncate max-w-[200px] px-1">{deckFileName}</span>
        <span className="text-[11px] shrink-0 select-none" title={lastSavedAt ? `上次保存 ${new Date(lastSavedAt).toLocaleTimeString()}` : sourceFileName}>
          {isSaving ? (
            <span className="text-white/55">保存中…</span>
          ) : isDirty ? (
            mode === 'file' && !fileHandle
              ? <span className="text-amber-300">● 未保存 · 点保存创建副本</span>
              : <span className="text-amber-300">● 未保存</span>
          ) : lastSavedAt ? (
            <span className="text-emerald-300">✓ 已保存</span>
          ) : null}
        </span>

        {/* Copy mental-model hint: original file is never touched */}
        <div className="relative group shrink-0">
          <button className="hds-bar-icon" aria-label="保存位置说明" title="保存位置说明">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="10" cy="10" r="7.5" />
              <path d="M10 9v4" strokeLinecap="round" />
              <circle cx="10" cy="6.4" r="0.4" fill="currentColor" stroke="none" />
            </svg>
          </button>
          <div className="hidden group-hover:block absolute left-0 top-full mt-2 w-64 p-3 rounded-xl text-[11px] leading-relaxed z-30 bg-[rgba(24,25,29,0.96)] border border-white/12 text-white/75 shadow-2xl">
            <p className="text-white/90 font-medium mb-1.5">原文件不会被改动</p>
            <p>源文件 <span className="text-white/90 font-mono">{sourceFileName}</span> 保持原样，所有编辑都写入副本：</p>
            <p className="mt-1 text-emerald-300 font-mono break-all">{deckFileName}</p>
          </div>
        </div>

        <span className="w-px h-4 bg-white/15 shrink-0" />
        <button
          onClick={() => undo()}
          disabled={!canUndo}
          className="hds-bar-icon disabled:opacity-30"
          aria-label="撤销"
          title="撤销 (⌘Z)"
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
          aria-label="重做"
          title="重做 (⇧⌘Z)"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M13 6l3.5 3.5L13 13" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16.5 9.5H8a4.5 4.5 0 0 0 0 9h2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Top-center: view-mode segmented control (F-10) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 hds-floating-bar">
        <div className="hds-segmented" role="tablist">
          <button
            role="tab"
            aria-selected={viewMode === 'visual'}
            className={`hds-segment ${viewMode === 'visual' ? 'is-active' : ''}`}
            onClick={() => setViewMode('visual')}
          >
            视觉
          </button>
          <button
            role="tab"
            aria-selected={viewMode === 'code'}
            className={`hds-segment ${viewMode === 'code' ? 'is-active' : ''}`}
            onClick={() => setViewMode('code')}
          >
            代码
          </button>
        </div>
      </div>

      {/* Top-right: inspector toggle + save + export */}
      <div className="absolute top-4 right-4 z-20 hds-floating-bar">
        <button
          onClick={() => setInspectorOpen((v) => !v)}
          className={`hds-bar-icon ${inspectorOpen ? 'is-active' : ''}`}
          aria-label={inspectorOpen ? '收起检查器' : '展开检查器'}
          title={selection ? (inspectorOpen ? '收起检查器' : '展开检查器') : '检查器（选中元素后可用）'}
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
          aria-label="历史版本"
          title={snapshotCount === 0 ? '历史版本（保存后可用）' : '历史版本'}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M10 5.5V10l3 1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.2 10a6.8 6.8 0 1 0 2-4.8M3.2 4.2v2.4h2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button onClick={() => void handleSave()} disabled={!isDirty} className="hds-bar-btn">
          保存
        </button>
        <button onClick={() => setExportOpen(true)} className="hds-btn-primary px-4 py-1.5 text-xs rounded-full">
          导出
        </button>
        <button
          onClick={() => openGuide('export')}
          className="hds-bar-icon"
          aria-label="使用指南"
          title="使用指南"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="10" cy="10" r="7.5" />
            <path d="M8 7.6a2 2 0 1 1 2.6 1.9c-.5.2-.9.6-.9 1.2v.4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10" cy="14" r="0.4" fill="currentColor" stroke="none" />
          </svg>
        </button>
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
            <div className="hds-canvas-card overflow-hidden">
              <ScaledCanvas
                ref={canvasRef}
                sectionHtml={currentSlide.html}
                headHtml={headHtml}
                assetsBaseUrl={assetsBaseUrl}
                containerWidth={fitWidth}
                onMessage={handleMessage}
              />
            </div>
          </main>

          {/* On-demand floating inspector — mounts only when selected and opened */}
          {showInspector && (
            <div className="absolute right-3 top-20 bottom-3 z-10">
              <PropertyPane onPatch={handlePatch} floating onClose={() => setInspectorOpen(false)} />
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
        title="返回首页"
        confirmLabel="放弃更改并返回"
        cancelLabel="取消"
        onConfirm={doLeaveHome}
        onCancel={() => setLeaveHomePromptOpen(false)}
        message={
          <>
            <p>当前有未保存的更改，返回首页将丢失这些更改。</p>
            <p className="mt-2 text-[var(--tertiary-label)]">如需保留，请先点「保存」再返回。</p>
          </>
        }
      />

      <ConfirmDialog
        open={firstSavePromptOpen}
        title="保存为副本"
        confirmLabel="保存副本"
        cancelLabel="取消"
        onConfirm={() => void confirmFirstSave()}
        onCancel={() => setFirstSavePromptOpen(false)}
        message={
          <>
            <p>为保护你打开的原文件，本工具不会改动它，而是把所有编辑保存到一个副本。</p>
            <p className="mt-2">接下来会弹出系统保存框，默认文件名为：</p>
            <p className="mt-1 font-mono text-[var(--label)] break-all">{deckFileName}</p>
            <p className="mt-2 text-[var(--tertiary-label)]">之后的保存会自动写入该副本，不再弹窗。</p>
          </>
        }
      />
    </div>
  );
}
