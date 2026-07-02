import { useEffect, type RefObject } from 'react';

/**
 * Trap keyboard focus inside a container while it is active.
 *
 * On activation: focuses the first focusable element (or `initialFocus`).
 * While active: Tab / Shift+Tab cycles within the container only.
 * On deactivation: returns focus to the element that had it before opening.
 *
 * Taste Skill §6 (focus management): modals and drawers must not let Tab
 * escape to the background document.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]:not([disabled])',
];

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE.join(','))
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

export function useFocusTrap<T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean,
  initialFocus?: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus initial target or first focusable element.
    const focusables = getFocusable(root);
    const target = initialFocus?.current ?? focusables[0];
    target?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = getFocusable(root);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || !root.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !root.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    root.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('keydown', onKey);
      previouslyFocused?.focus();
    };
  }, [active, ref, initialFocus]);
}
