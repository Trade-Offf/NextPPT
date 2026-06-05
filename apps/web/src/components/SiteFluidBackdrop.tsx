import { Suspense, lazy, useEffect, useState } from 'react';

const LiquidEther = lazy(() => import('./LiquidEther.js'));

// Stable identity: a new array each render would re-init the whole WebGL sim.
const FLUID_COLORS = ['#3a31a8', '#8b8ef0', '#c9cbff'];

/**
 * Full-page interactive fluid backdrop for the landing page. Lazy-loaded and
 * gated: skipped under reduced-motion, on small screens, or without WebGL, so
 * it never blocks first paint or burns battery where it doesn't belong.
 */
export function SiteFluidBackdrop() {
  const [enabled, setEnabled] = useState(false);
  // 'full' on roomy, capable machines; 'lite' on mid-size screens or low-core
  // devices — fewer Poisson iterations + lower sim resolution to save GPU/battery.
  const [tier, setTier] = useState<'full' | 'lite'>('full');

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(max-width: 640px)').matches) return;
    let webglOk = false;
    try {
      const c = document.createElement('canvas');
      webglOk = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      webglOk = false;
    }
    if (!webglOk) return;

    const cores = navigator.hardwareConcurrency ?? 8;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mem = (navigator as any).deviceMemory as number | undefined;
    const midScreen = window.matchMedia('(max-width: 1024px)').matches;
    const lowPower = cores <= 4 || (typeof mem === 'number' && mem <= 4);
    setTier(midScreen || lowPower ? 'lite' : 'full');
    setEnabled(true);
  }, []);

  if (!enabled) return null;

  const lite = tier === 'lite';

  return (
    <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
      <Suspense fallback={null}>
        <LiquidEther
          colors={FLUID_COLORS}
          mouseForce={18}
          cursorSize={90}
          resolution={lite ? 0.35 : 0.5}
          iterationsPoisson={lite ? 12 : 16}
          isViscous={false}
          autoDemo
          autoSpeed={0.4}
          autoIntensity={1.8}
          takeoverDuration={0.25}
          autoResumeDelay={2500}
          autoRampDuration={0.6}
        />
      </Suspense>
    </div>
  );
}
