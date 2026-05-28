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
        borderRadius: 4,
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

  return (
    <aside
      className="shrink-0 bg-white border-r border-[var(--rule)] overflow-y-auto flex flex-col gap-2 p-2"
      style={{ width: THUMB_W + 16 }}
    >
      {slides.map((slide, idx) => (
        <button
          key={slide.id}
          onClick={() => setCurrentSlide(slide.id)}
          className={cn(
            'relative flex flex-col items-center gap-1 rounded-md border p-1 text-left transition-all hover:border-blue-400',
            slide.id === currentId
              ? 'border-blue-500 ring-2 ring-blue-200'
              : 'border-[var(--rule)]',
          )}
        >
          <SlideThumbnail sectionHtml={slide.html} headHtml={headHtml} />
          <span className="text-[10px] text-[var(--slate)] font-mono self-center">{idx + 1}</span>
        </button>
      ))}
    </aside>
  );
}
