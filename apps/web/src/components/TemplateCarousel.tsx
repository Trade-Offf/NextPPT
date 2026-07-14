import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TEMPLATES, type TemplateItem } from '../data/templates.js';

const CAROUSEL_IDS: string[] = ['sakura-chroma', 'cobalt-grid', 'peoples-platform', 'long-table', 'nextppt-kami'];
const AUTOPLAY_MS = 5200;

interface SlidePreviewProps {
  url: string;
  kind: TemplateItem['kind'];
  active: boolean;
}

/**
 * Scaled-down live iframe of the real template HTML.
 * The iframe is sized to the template's native dimensions and scaled to fit
 * the container width. We use object-fit-like math so the preview fills the
 * stage edge-to-edge with no letterboxing.
 */
function SlidePreview({ url, kind, active }: SlidePreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const isDoc = kind === 'doc';
  const baseW = isDoc ? 794 : 1280;
  const baseH = isDoc ? 1123 : 720;

  // Scale to cover: pick the larger scale so the iframe fills the container,
  // then center it so we always show the top portion (most important content).
  const scaleW = size.w / baseW;
  const scaleH = size.h / baseH;
  const scale = Math.max(scaleW, scaleH) || 0.0001;
  const scaledW = baseW * scale;
  // Center horizontally; anchor to top vertically (top content matters most)
  const offsetX = (size.w - scaledW) / 2;
  const offsetY = 0;

  return (
    <div
      ref={ref}
      className="w-full h-full overflow-hidden"
      style={{ position: 'relative', background: isDoc ? '#f5f4ed' : '#0d1117' }}
    >
      <iframe
        src={url}
        title="template preview"
        tabIndex={-1}
        scrolling="no"
        aria-hidden={!active}
        style={{
          width: baseW,
          height: baseH,
          border: 0,
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
          opacity: active ? 1 : 0,
          transition: 'opacity 700ms cubic-bezier(0.4, 0, 0.2, 1)',
          // Position the scaled iframe
          marginLeft: offsetX,
          marginTop: offsetY,
        }}
      />
    </div>
  );
}

interface TemplateCarouselProps {
  onOpenSample: (url: string, fileName: string) => void;
  loading: boolean;
}

export function TemplateCarousel({ onOpenSample, loading }: TemplateCarouselProps) {
  const { t } = useTranslation('templates');
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slides = CAROUSEL_IDS
    .map((id) => TEMPLATES.find((tpl) => tpl.id === id))
    .filter((v): v is TemplateItem => Boolean(v));

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % slides.length);
  }, [slides.length]);

  const goTo = useCallback((i: number) => setIndex(i), []);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    timerRef.current = setTimeout(next, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index, paused, next, slides.length]);

  const current = slides[index];

  const handleOpen = () => {
    if (!current?.sampleUrl || loading) return;
    const fileName = current.sampleUrl.split('/').pop() || 'sample.html';
    onOpenSample(current.sampleUrl, fileName);
  };

  if (!current) return null;

  const title = t(`items.${current.id}.title`, { defaultValue: current.id });
  const desc = t(`items.${current.id}.desc`, { defaultValue: '' });

  return (
    <div
      className="relative w-full select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── Stage ──────────────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden rounded-2xl cursor-pointer group"
        onClick={handleOpen}
        style={{
          aspectRatio: '16 / 9',
          background: '#0a0a0b',
          boxShadow:
            '0 24px 48px -16px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        {/* Stacked slides */}
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            className="absolute inset-0"
            style={{
              opacity: i === index ? 1 : 0,
              transition: 'opacity 700ms cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: i === index ? 2 : 1,
            }}
          >
            <SlidePreview url={slide.sampleUrl || ''} kind={slide.kind} active={i === index} />
          </div>
        ))}

        {/* ── Top-left: index badge (with scrim for legibility on any bg) ── */}
        <div className="absolute top-4 left-4 flex items-center gap-2" style={{ zIndex: 4 }}>
          <span
            className="px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider text-white"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
          >
            {String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
          </span>
          <span
            className="px-2 py-1 rounded-full text-[10px] font-mono text-white"
            style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)' }}
          >
            {current.kind === 'deck' ? '16:9 DECK' : 'A4 DOC'}
          </span>
        </div>

        {/* ── Hover-only open button — floats over image, no text to clash ── */}
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ zIndex: 4, background: 'rgba(0,0,0,0.25)' }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); handleOpen(); }}
            disabled={loading}
            className="inline-flex items-center gap-2 pl-5 pr-4 py-2.5 rounded-full text-[13px] font-medium text-white transition-all duration-300 hover:scale-[1.05] active:scale-[0.98] disabled:opacity-40"
            style={{
              background: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
          >
            <span>{t('carousel.open', { defaultValue: 'Open in Editor' })}</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Info bar below the stage — no background dependency ── */}
      <div className="mt-4 flex items-end justify-between gap-4">
        <div
          key={current.id}
          className="min-w-0 flex-1"
          style={{ animation: 'carouselSlideUp 500ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] sm:text-[16px] font-semibold text-[var(--label)] tracking-tight">
              {title}
            </h3>
            <span className="shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--system-blue)]/10 text-[var(--system-blue)]">
              {current.kind === 'deck' ? '16:9' : 'A4'}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-[var(--secondary-label)] leading-relaxed line-clamp-1">
            {desc}
          </p>
        </div>
      </div>

      {/* ── Minimal dot indicators (no progress bar) ──────── */}
      <div className="mt-4 flex items-center justify-center gap-2.5">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            onClick={() => goTo(i)}
            aria-label={`Slide ${i + 1}`}
            className="rounded-full transition-all duration-400 ease-out"
            style={{
              width: i === index ? 24 : 6,
              height: 6,
              background:
                i === index
                  ? 'var(--system-blue, #5e6ad2)'
                  : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes carouselSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="carouselSlideUp"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
