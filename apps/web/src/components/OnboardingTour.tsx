/**
 * OnboardingTour — Linear-flavoured coach-mark overlay.
 *
 * Spotlight (box-shadow cutout) + an absolutely-positioned tooltip card with a
 * connector arrow pointing back to the anchor. Placement auto-flips when the
 * preferred side would overflow the viewport, so the tooltip is never clipped
 * by window edges or chrome.
 *
 * Anchors are located by `data-onboarding-anchor` attributes in EditorPage so
 * the tour survives className refactors. If an anchor is missing (e.g. doc
 * mode hides the mode-toggle), that step is skipped gracefully.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

type Placement = 'top' | 'bottom' | 'left' | 'right';

interface Step {
  anchor: string;
  placement: Placement;
  /** i18n key suffix under `editor.onboarding`. */
  key: string;
}

const STEPS: Step[] = [
  { anchor: 'canvas', placement: 'bottom', key: 'step1' },
  { anchor: 'mode-toggle', placement: 'bottom', key: 'step2' },
  { anchor: 'inspector', placement: 'left', key: 'step3' },
  { anchor: 'code', placement: 'bottom', key: 'step4' },
  { anchor: 'export', placement: 'bottom', key: 'step5' },
];

interface Rect { left: number; top: number; width: number; height: number; }

const PADDING = 6;
const TOOLTIP_WIDTH = 304;
const TOOLTIP_GAP = 12;
const VIEWPORT_MARGIN = 12;
// Estimated tooltip height (used for flip decisions before first layout).
const TOOLTIP_EST_HEIGHT = 168;

/** Resolve an anchor element by its data-onboarding-anchor value. */
function findAnchor(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-onboarding-anchor="${id}"]`);
}

/** Measure an anchor's rect. Returns null if not visible. */
function measureAnchor(el: HTMLElement | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

interface PlacementResult {
  left: number;
  top: number;
  /** Final placement after collision-driven flipping. */
  placement: Placement;
}

/**
 * Compute tooltip position with viewport-aware flipping.
 *
 * Try the preferred placement first; if it overflows the viewport, flip to the
 * opposite side, then the remaining two. If nothing fits cleanly, clamp both
 * axes into the viewport as a last resort. The returned placement drives the
 * connector-arrow direction.
 */
function placeTooltip(anchor: Rect, preferred: Placement): PlacementResult {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const fitsHorizontally = (left: number) =>
    left >= VIEWPORT_MARGIN && left + TOOLTIP_WIDTH <= vw - VIEWPORT_MARGIN;
  const fitsVertically = (top: number, h = TOOLTIP_EST_HEIGHT) =>
    top >= VIEWPORT_MARGIN && top + h <= vh - VIEWPORT_MARGIN;

  const tryPlace = (placement: Placement): { left: number; top: number } | null => {
    switch (placement) {
      case 'bottom': {
        const left = anchor.left + anchor.width / 2 - TOOLTIP_WIDTH / 2;
        const top = anchor.top + anchor.height + TOOLTIP_GAP;
        return fitsHorizontally(left) && fitsVertically(top) ? { left, top } : null;
      }
      case 'top': {
        const left = anchor.left + anchor.width / 2 - TOOLTIP_WIDTH / 2;
        const top = anchor.top - TOOLTIP_GAP - TOOLTIP_EST_HEIGHT;
        return fitsHorizontally(left) && fitsVertically(top) ? { left, top } : null;
      }
      case 'right': {
        const left = anchor.left + anchor.width + TOOLTIP_GAP;
        const top = anchor.top + anchor.height / 2 - TOOLTIP_EST_HEIGHT / 2;
        return fitsHorizontally(left) && fitsVertically(top) ? { left, top } : null;
      }
      case 'left': {
        const left = anchor.left - TOOLTIP_WIDTH - TOOLTIP_GAP;
        const top = anchor.top + anchor.height / 2 - TOOLTIP_EST_HEIGHT / 2;
        return fitsHorizontally(left) && fitsVertically(top) ? { left, top } : null;
      }
    }
  };

  // Order: preferred → opposite → remaining two, preferring bottom/top first.
  const opposite: Record<Placement, Placement> = {
    top: 'bottom', bottom: 'top', left: 'right', right: 'left',
  };
  const order: Placement[] = [
    preferred,
    opposite[preferred],
    ...(preferred === 'left' || preferred === 'right' ? ['bottom' as Placement, 'top' as Placement] : ['right' as Placement, 'left' as Placement]),
  ];

  for (const p of order) {
    const r = tryPlace(p);
    if (r) return { ...r, placement: p };
  }

  // Last resort: clamp the preferred placement into the viewport so the tooltip
  // stays fully visible even on tiny viewports.
  let left: number;
  let top: number;
  switch (preferred) {
    case 'bottom':
      left = anchor.left + anchor.width / 2 - TOOLTIP_WIDTH / 2;
      top = anchor.top + anchor.height + TOOLTIP_GAP;
      break;
    case 'top':
      left = anchor.left + anchor.width / 2 - TOOLTIP_WIDTH / 2;
      top = anchor.top - TOOLTIP_GAP - TOOLTIP_EST_HEIGHT;
      break;
    case 'right':
      left = anchor.left + anchor.width + TOOLTIP_GAP;
      top = anchor.top + anchor.height / 2 - TOOLTIP_EST_HEIGHT / 2;
      break;
    case 'left':
      left = anchor.left - TOOLTIP_WIDTH - TOOLTIP_GAP;
      top = anchor.top + anchor.height / 2 - TOOLTIP_EST_HEIGHT / 2;
      break;
  }
  left = Math.max(VIEWPORT_MARGIN, Math.min(vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN, left));
  top = Math.max(VIEWPORT_MARGIN, Math.min(vh - TOOLTIP_EST_HEIGHT - VIEWPORT_MARGIN, top));
  return { left, top, placement: preferred };
}

interface OnboardingTourProps {
  onClose: () => void;
}

export function OnboardingTour({ onClose }: OnboardingTourProps) {
  const { t } = useTranslation('editor');
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; placement: Placement }>({
    left: 0, top: 0, placement: 'bottom',
  });
  const rafRef = useRef<number>(0);

  const step = STEPS[index];

  const reposition = useCallback(() => {
    const el = findAnchor(step.anchor);
    const measured = measureAnchor(el);
    if (measured) {
      setRect(measured);
      setPos(placeTooltip(measured, step.placement));
    } else {
      // Anchor not visible (e.g. wrong mode) → skip to next step.
      setRect(null);
      setIndex((i) => Math.min(STEPS.length - 1, i + 1));
    }
  }, [step]);

  useEffect(() => {
    reposition();
    const onResize = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(reposition);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [reposition]);

  // Keyboard: Esc to close, ←/→ to navigate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(STEPS.length - 1, i + 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const next = () => {
    if (index >= STEPS.length - 1) onClose();
    else setIndex((i) => i + 1);
  };
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  const spotlightStyle = rect
    ? {
        left: rect.left - PADDING,
        top: rect.top - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      }
    : { left: -9999, top: -9999, width: 0, height: 0 };

  return (
    <div className="hds-onboarding-overlay" role="dialog" aria-label={t('onboarding.ariaLabel')}>
      {/* Full-screen dim mask with a transparent hole cut by box-shadow */}
      <div
        className="hds-onboarding-spotlight"
        style={{
          ...spotlightStyle,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
        }}
      />

      {/* Tooltip card */}
      <div
        className={`hds-onboarding-tooltip is-${pos.placement}`}
        style={{ left: pos.left, top: pos.top, width: TOOLTIP_WIDTH }}
      >
        <span className="hds-onboarding-arrow" aria-hidden />
        <div className="hds-onboarding-head">
          <span className="hds-onboarding-counter">{index + 1} / {STEPS.length}</span>
        </div>
        <h3 className="hds-onboarding-title">{t(`onboarding.${step.key}.title`)}</h3>
        <p className="hds-onboarding-body">{t(`onboarding.${step.key}.body`)}</p>

        <div className="hds-onboarding-actions">
          <button className="hds-onboarding-skip" onClick={onClose}>
            {t('onboarding.skip')}
          </button>
          <div className="hds-onboarding-nav">
            {index > 0 && (
              <button className="hds-onboarding-prev" onClick={prev}>
                {t('onboarding.prev')}
              </button>
            )}
            <button className="hds-onboarding-next" onClick={next}>
              {index >= STEPS.length - 1 ? t('onboarding.done') : t('onboarding.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
