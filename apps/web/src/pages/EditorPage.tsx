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

  const selection = useDeckStore((s) => s.selection);

  const [exportOpen, setExportOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
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
    <div className="relative h-full hds-stage overflow-hidden">
      {/* ── Floating chrome ─────────────────────────────────────── */}
      {/* Top-left: sidebar toggle + filename + save status */}
      <div className="absolute top-4 left-4 z-20 hds-floating-bar">
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
        <span className="text-[11px] shrink-0 select-none pr-1" title={lastSavedAt ? `上次保存 ${new Date(lastSavedAt).toLocaleTimeString()}` : sourceFileName}>
          {isSaving ? (
            <span className="text-white/55">保存中…</span>
          ) : isDirty ? (
            <span className="text-amber-300">● 未保存</span>
          ) : lastSavedAt ? (
            <span className="text-emerald-300">✓ 已保存</span>
          ) : null}
        </span>
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
        <button onClick={() => void handleSave()} disabled={!isDirty} className="hds-bar-btn">
          保存
        </button>
        <button onClick={() => setExportOpen(true)} className="hds-btn-primary px-4 py-1.5 text-xs rounded-full">
          导出
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
    </div>
  );
}
