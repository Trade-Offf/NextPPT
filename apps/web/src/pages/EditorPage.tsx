import { useState, useRef, useCallback, useEffect } from 'react';
import { useDeckStore } from '../store/deckStore.js';
import { ScaledCanvas, type CanvasHandle } from '../components/CanvasFrame.js';
import { SlideListPane } from '../components/SlideListPane.js';
import { PropertyPane } from '../components/PropertyPane.js';
import { CodeEditorPane } from '../components/CodeEditorPane.js';
import { ExportDrawer } from '../components/ExportDrawer.js';
import type { PatchOp, RuntimeMessage } from '@hds/protocol';
import { writeDeck, rebuildDeckHtml, writeAsset, saveAsNewFile, writeFileHandle } from '../fs/adapter.js';
import { registerBlobPath } from '../fs/assetResolver.js';

export function EditorPage() {
  const slides = useDeckStore((s) => s.slides);
  const currentSlideId = useDeckStore((s) => s.currentSlideId);
  const dirHandle = useDeckStore((s) => s.dirHandle);
  const fileHandle = useDeckStore((s) => s.fileHandle);
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

  const [exportOpen, setExportOpen] = useState(false);
  const [containerWidth, setContainerWidth] = useState(800);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<CanvasHandle>(null);

  const currentSlide = slides.find((s) => s.id === currentSlideId);

  // Measure container width for responsive canvas scaling.
  // Re-attaches when returning from code mode (the <main> remounts).
  useEffect(() => {
    if (viewMode !== 'visual' || !canvasContainerRef.current) return;
    const el = canvasContainerRef.current;
    setContainerWidth(Math.floor(el.clientWidth));
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode]);

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
  // to the working file handle, acquiring it via "save as" on first save.
  const handleSave = useCallback(async () => {
    if (!dirHandle && !fileHandle && deckFileName === '') return;
    markSaving();
    const rebuilt = rebuildDeckHtml(rawHtml, slides);
    setRawHtml(rebuilt);
    try {
      if (dirHandle) {
        await writeDeck(dirHandle, deckFileName, rebuilt, sourceFileName);
      } else if (fileHandle) {
        await writeFileHandle(fileHandle, rebuilt);
      } else {
        // First save in single-file mode: prompt "save as" (needs user gesture).
        const fh = await saveAsNewFile(deckFileName, rebuilt);
        setWorkingFileHandle(fh);
      }
      markSaved();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error('save failed', err);
      markDirty();
    }
  }, [dirHandle, fileHandle, setWorkingFileHandle, deckFileName, rawHtml, slides, sourceFileName, markSaving, setRawHtml, markSaved, markDirty]);

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
    <div className="flex flex-col h-full">
      {/* macOS-style unified toolbar / title bar */}
      <header className="hds-toolbar h-14 flex items-center px-4 gap-3 shrink-0">
        <div className="hds-traffic-lights" aria-hidden>
          <span className="tl tl-red" />
          <span className="tl tl-amber" />
          <span className="tl tl-green" />
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-semibold text-[var(--label)] truncate">{deckFileName}</span>
          <span className="text-[11px] shrink-0 select-none" title={lastSavedAt ? `上次保存 ${new Date(lastSavedAt).toLocaleTimeString()}` : sourceFileName}>
            {isSaving ? (
              <span className="text-[var(--tertiary-label)]">保存中…</span>
            ) : isDirty ? (
              <span className="text-amber-500">● 未保存</span>
            ) : lastSavedAt ? (
              <span className="text-emerald-500">✓ 已保存</span>
            ) : null}
          </span>
        </div>

        {/* View-mode segmented control (F-10) */}
        <div className="mx-auto hds-segmented" role="tablist">
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

        <button
          onClick={() => void handleSave()}
          disabled={!isDirty}
          className="hds-btn px-3 py-1.5 text-xs disabled:opacity-40"
        >
          保存
        </button>

        <button
          onClick={() => setExportOpen(true)}
          className="hds-btn-primary px-3 py-1.5 text-xs"
        >
          导出
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <SlideListPane />

        {viewMode === 'code' ? (
          <CodeEditorPane key={currentSlideId} />
        ) : (
          <main ref={canvasContainerRef} className="flex-1 min-w-0 hds-canvas-stage flex items-center justify-center p-8 overflow-auto canvas-host">
            <div className="hds-canvas-card overflow-hidden">
              <ScaledCanvas
                ref={canvasRef}
                sectionHtml={currentSlide.html}
                headHtml={headHtml}
                assetsBaseUrl={assetsBaseUrl}
                containerWidth={containerWidth}
                onMessage={handleMessage}
              />
            </div>
          </main>
        )}

        {viewMode === 'visual' && <PropertyPane onPatch={handlePatch} />}
      </div>

      <ExportDrawer open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
