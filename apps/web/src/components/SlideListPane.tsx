import { useState } from 'react';
import { useDeckStore } from '../store/deckStore.js';
import { cn } from '../lib/cn.js';

const THUMB_W = 176; // px – thumbnail display width
const THUMB_H = Math.round(THUMB_W * (720 / 1280)); // 99px

/** A scaled-down live iframe preview of one slide */
function SlideThumbnail({ sectionHtml, headHtml }: { sectionHtml: string; headHtml: string }) {
  const scale = THUMB_W / 1280;

  const srcdoc = `<!doctype html><html><head>
<meta charset="UTF-8">
${headHtml}
<style>
  html,body{width:1280px;height:720px;overflow:hidden;margin:0;padding:0;display:block;}
  section[class~="slide"]{width:1280px!important;min-height:720px!important;max-height:720px!important;}
</style>
</head><body>${sectionHtml}</body></html>`;

  return (
    <div
      style={{
        width: THUMB_W,
        height: THUMB_H,
        overflow: 'hidden',
        position: 'relative',
        borderRadius: 6,
        background: '#1a1a1a',
      }}
    >
      <div
        style={{
          width: 1280,
          height: 720,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
        }}
      >
        <iframe
          srcDoc={srcdoc}
          sandbox="allow-same-origin allow-scripts"
          style={{ width: 1280, height: 720, border: 'none', display: 'block' }}
          title="thumb"
          loading="lazy"
        />
      </div>
    </div>
  );
}

export function SlideListPane() {
  const slides = useDeckStore((s) => s.slides);
  const headHtml = useDeckStore((s) => s.headHtml);
  const currentId = useDeckStore((s) => s.currentSlideId);
  const setCurrentSlide = useDeckStore((s) => s.setCurrentSlide);
  const duplicateSlide = useDeckStore((s) => s.duplicateSlide);
  const deleteSlide = useDeckStore((s) => s.deleteSlide);
  const reorderSlides = useDeckStore((s) => s.reorderSlides);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  return (
    <aside
      className="hds-sidebar shrink-0 h-full overflow-y-auto flex flex-col gap-2 p-3"
      style={{ width: THUMB_W + 24 }}
    >
      {slides.map((slide, idx) => (
        <div
          key={slide.id}
          draggable
          onDragStart={() => setDragIndex(idx)}
          onDragOver={(e) => { e.preventDefault(); setOverIndex(idx); }}
          onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIndex !== null && dragIndex !== idx) reorderSlides(dragIndex, idx);
            setDragIndex(null);
            setOverIndex(null);
          }}
          className={cn(
            'group relative rounded-lg border p-1 transition-all',
            slide.id === currentId
              ? 'border-[var(--system-blue)] ring-2 ring-[rgba(0,122,255,0.35)]'
              : 'border-[var(--rule)] hover:border-[rgba(0,122,255,0.6)]',
            overIndex === idx && dragIndex !== null && dragIndex !== idx ? 'ring-2 ring-[rgba(0,122,255,0.5)]' : '',
            dragIndex === idx ? 'opacity-40' : '',
          )}
        >
          <button
            onClick={() => setCurrentSlide(slide.id)}
            className="block w-full text-left cursor-pointer"
            title={`第 ${idx + 1} 页`}
          >
            <SlideThumbnail sectionHtml={slide.html} headHtml={headHtml} />
          </button>

          {/* Page number */}
          <span className="absolute left-2 top-2 px-1.5 py-0.5 rounded bg-black/55 text-white text-[10px] font-mono leading-none">
            {idx + 1}
          </span>

          {/* Hover actions */}
          <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <ActionBtn title="上移" disabled={idx === 0} onClick={() => reorderSlides(idx, idx - 1)}>↑</ActionBtn>
            <ActionBtn title="下移" disabled={idx === slides.length - 1} onClick={() => reorderSlides(idx, idx + 1)}>↓</ActionBtn>
            <ActionBtn title="复制" onClick={() => duplicateSlide(slide.id)}>⧉</ActionBtn>
            <ActionBtn title="删除" disabled={slides.length <= 1} danger onClick={() => deleteSlide(slide.id)}>✕</ActionBtn>
          </div>
        </div>
      ))}
    </aside>
  );
}

function ActionBtn({
  children, title, onClick, disabled, danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        'h-5 min-w-5 px-1 rounded-md bg-white/85 backdrop-blur border border-[var(--rule)] text-[10px] leading-none flex items-center justify-center shadow-sm transition-colors disabled:opacity-30',
        danger ? 'text-red-500 hover:bg-red-50' : 'text-[var(--slate)] hover:bg-[var(--cobalt-lt)]',
      )}
    >
      {children}
    </button>
  );
}
