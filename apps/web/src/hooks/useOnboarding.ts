import { useState, useCallback, useMemo } from 'react';

/**
 * Onboarding state persisted to localStorage so each user only sees the tour
 * and contextual hints once. Versioned key — bump the suffix to force a re-show
 * after a major redesign.
 */
const STORAGE_KEY = 'hds_onboarding_v1';

interface OnboardingState {
  /** Main coach-mark tour completed or skipped. */
  tourDone: boolean;
  /** "Drag mode" contextual hint already shown. */
  dragHintShown: boolean;
  /** "Code view" contextual hint already shown. */
  codeHintShown: boolean;
}

const INITIAL: OnboardingState = {
  tourDone: false,
  dragHintShown: false,
  codeHintShown: false,
};

function readState(): OnboardingState {
  if (typeof window === 'undefined') return INITIAL;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return { ...INITIAL, ...parsed };
  } catch {
    return INITIAL;
  }
}

function writeState(state: OnboardingState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage may be unavailable (private mode / quota) — non-fatal. */
  }
}

/**
 * Tracks one-time onboarding flags. Each setter persists immediately so a
 * refresh never re-triggers a hint the user already dismissed.
 */
export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(readState);

  const update = useCallback((patch: Partial<OnboardingState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      writeState(next);
      return next;
    });
  }, []);

  const actions = useMemo(
    () => ({
      markTourDone: () => update({ tourDone: true }),
      markDragHintShown: () => update({ dragHintShown: true }),
      markCodeHintShown: () => update({ codeHintShown: true }),
      reset: () => update(INITIAL),
    }),
    [update],
  );

  return { state, ...actions };
}
