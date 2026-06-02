import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

// Register plugins exactly once for the whole app. Guarded so the module is
// import-safe during prerender (vite-react-ssg) where there is no DOM.
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

/** True when the user asked the OS to minimise motion. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Reveal a set of elements as they scroll into view. Honours reduced-motion by
 * leaving everything visible (no animation). Call inside a useGSAP() scope so
 * GSAP auto-reverts on unmount.
 *
 * @param targets  gsap target (selector string scoped by useGSAP, node, or list)
 * @param opts.stagger  per-item delay when several elements share one trigger
 */
export function revealOnScroll(
  targets: gsap.TweenTarget,
  opts: {
    y?: number;
    stagger?: number;
    trigger?: Element | string;
    start?: string;
    /** Custom scroll container (e.g. a fixed overlay that scrolls internally). */
    scroller?: Element | string | null;
  } = {},
) {
  if (prefersReducedMotion()) {
    gsap.set(targets, { autoAlpha: 1, y: 0 });
    return;
  }
  const { y = 28, stagger = 0.08, trigger, start = 'top 82%', scroller } = opts;
  gsap.from(targets, {
    autoAlpha: 0,
    y,
    duration: 0.7,
    ease: 'power3.out',
    stagger,
    scrollTrigger: {
      trigger: trigger ?? (targets as Element),
      start,
      once: true,
      ...(scroller ? { scroller } : {}),
    },
  });
}

export { gsap, ScrollTrigger, useGSAP };
