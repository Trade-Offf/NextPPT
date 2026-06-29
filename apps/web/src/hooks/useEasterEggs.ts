import { useState, useCallback } from 'react';

/**
 * Easter-egg unlock state, persisted to localStorage so unlocks survive refresh.
 * Separated from onboarding flags — these are bonus discoveries, not workflow.
 */
const STORAGE_KEY = 'hds_easter_eggs_v1';

interface EasterEggState {
  /** Terminal template unlocked via the "42" secret code. Gates its visibility in the template market. */
  terminalUnlocked: boolean;
  /** Terminal theme currently active (toggled on/off after unlock). */
  terminalActive: boolean;
}

const INITIAL: EasterEggState = {
  terminalUnlocked: false,
  terminalActive: false,
};

function readState(): EasterEggState {
  if (typeof window === 'undefined') return INITIAL;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as Partial<EasterEggState>;
    return { ...INITIAL, ...parsed };
  } catch {
    return INITIAL;
  }
}

function writeState(state: EasterEggState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* non-fatal */
  }
}

/**
 * Manages easter-egg unlock flags + persistence.
 */
export function useEasterEggs() {
  const [state, setState] = useState<EasterEggState>(readState);

  const patch = useCallback((p: Partial<EasterEggState>) => {
    setState((prev) => {
      const next = { ...prev, ...p };
      writeState(next);
      return next;
    });
  }, []);

  const unlockTerminal = useCallback(() => patch({ terminalUnlocked: true, terminalActive: true }), [patch]);
  const toggleTerminal = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, terminalActive: !prev.terminalActive };
      writeState(next);
      return next;
    });
  }, []);
  const reset = useCallback(() => patch(INITIAL), [patch]);

  return { state, unlockTerminal, toggleTerminal, reset };
}
