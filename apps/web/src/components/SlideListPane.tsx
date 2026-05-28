import { useDeckStore } from '../store/deckStore.js';
import { cn } from '../lib/cn.js';

export function SlideListPane() {
  const slides = useDeckStore((s) => s.slides);
  const currentId = useDeckStore((s) => s.currentSlideId);
  const setCurrentSlide = useDeckStore((s) => s.setCurrentSlide);

  return (
    <aside className="w-[200px] shrink-0 bg-white border-r border-[var(--rule)] overflow-y-auto flex flex-col gap-2 p-2">
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
          {/* Thumbnail */}
          <div className="w-full aspect-video bg-[var(--paper)] rounded overflow-hidden flex items-center justify-center">
            {slide.thumbnail ? (
              <img src={slide.thumbnail} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] text-[var(--silver)]">Slide {idx + 1}</span>
            )}
          </div>
          {/* Page number */}
          <span className="text-[10px] text-[var(--slate)] font-mono">{slide.ordinal}</span>
        </button>
      ))}
    </aside>
  );
}
