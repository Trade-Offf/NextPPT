import { useState, useRef, useCallback, useEffect } from 'react';
import { useDeckStore } from '../store/deckStore.js';
import { ScaledCanvas, type CanvasHandle } from '../components/CanvasFrame.js';
import { SlideListPane } from '../components/SlideListPane.js';
import { PropertyPane } from '../components/PropertyPane.js';
import { ExportDrawer } from '../components/ExportDrawer.js';
import type { PatchOp, RuntimeMessage } from '@hds/protocol';
import { writeDeck, rebuildDeckHtml, writeAsset } from '../fs/adapter.js';

export function EditorPage() {
  const slides = useDeckStore((s) => s.slides);
  const currentSlideId = useDeckStore((s) => s.currentSlideId);
  const dirHandle = useDeckStore((s) => s.dirHandle);
  const deckFileName = useDeckStore((s) => s.deckFileName);
  const rawHtml = useDeckStore((s) => s.rawHtml);
  const headHtml = useDeckStore((s) => s.headHtml);
  const sourceFileName = useDeckStore((s) => s.sourceFileName);
  const isDirty = useDeckStore((s) => s.isDirty);
  const updateSlideHtml = useDeckStore((s) => s.updateSlideHtml);
  const setRawHtml = useDeckStore((s) => s.setRawHtml);
  const markSaving = useDeckStore((s) => s.markSaving);
  const markSaved = useDeckStore((s) => s.markSaved);

  const [exportOpen, setExportOpen] = useState(false);
  const [containerWidth, setContainerWidth] = useState(800);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<CanvasHandle>(null);

  const currentSlide = slides.find((s) => s.id === currentSlideId);

  // Measure container width for responsive canvas scaling
  useEffect(() => {
    if (!canvasContainerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(canvasContainerRef.current);
    return () => ro.disconnect();
  }, []);

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

  // Save to disk
  const handleSave = useCallback(async () => {
    if (!dirHandle) return;
    markSaving();
    const rebuilt = rebuildDeckHtml(rawHtml, slides);
    setRawHtml(rebuilt);
    await writeDeck(dirHandle, deckFileName, rebuilt, sourceFileName);
    markSaved();
  }, [dirHandle, deckFileName, rawHtml, slides, markSaving, setRawHtml, markSaved]);

  // Keyboard save shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty) handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDirty, handleSave]);

  // Handle image replacement from PropertyPane
  useEffect(() => {
    const handler = async (e: Event) => {
      const { file, selector } = (e as CustomEvent<{ file: File; selector: string }>).detail;
      if (!dirHandle || !currentSlideId) return;
      const relativePath = await writeAsset(dirHandle, file);
      updateSlideHtml(currentSlideId, currentSlide?.html.replace(new RegExp(`(?<=<img[^>]*src=")[^"]*(?="[^>]*${selector.split(' > ').pop()})`), relativePath) ?? currentSlide?.html ?? '');
    };
    window.addEventListener('hds-replace-image', handler as EventListener);
    return () => window.removeEventListener('hds-replace-image', handler as EventListener);
  }, [dirHandle, currentSlideId, currentSlide, updateSlideHtml]);

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
      {/* Toolbar */}
      <header className="h-12 bg-white border-b border-[var(--rule)] flex items-center px-4 gap-3 shrink-0">
        <div className="mr-auto flex items-center gap-2 min-w-0">
          <span className="text-xs text-[var(--silver)] truncate hidden sm:block">{sourceFileName}</span>
          <span className="text-[var(--silver)] text-xs hidden sm:block">→</span>
          <span className="text-sm font-semibold text-[var(--ink)] truncate">{deckFileName}</span>
          {isDirty && <span className="text-orange-400 text-xs shrink-0" title="有未保存的修改">●</span>}
        </div>

        <button
          onClick={handleSave}
          disabled={!isDirty || !dirHandle}
          className="px-3 py-1.5 text-xs rounded-md border border-[var(--rule)] text-[var(--slate)] disabled:opacity-40 hover:bg-[var(--paper)] transition-colors"
        >
          保存
        </button>

        <button
          onClick={() => setExportOpen(true)}
          className="px-3 py-1.5 text-xs rounded-md bg-[var(--cobalt)] text-white hover:bg-blue-700 transition-colors"
        >
          导出 ↓
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        <SlideListPane />

        {/* Canvas area */}
        <main ref={canvasContainerRef} className="flex-1 min-w-0 bg-[#e8edf3] flex items-center justify-center p-6 overflow-auto canvas-host">
          <div className="shadow-lg rounded overflow-hidden">
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

        <PropertyPane onPatch={handlePatch} />
      </div>

      <ExportDrawer open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
