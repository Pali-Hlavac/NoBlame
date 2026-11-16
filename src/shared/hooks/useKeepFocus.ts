import { useLayoutEffect, useRef, type FocusEvent, type RefObject } from "react";

/**
 * Keeps the keyboard in a list (`scrollRef`, focusable) when what had focus inside it goes away:
 * a row's button whose file moved to another list, a row scrolled out of the rendered ones.
 * Without it the focus falls to the page and the arrows only scroll (the browser scrolls around
 * the last click). Spread `onFocus` and `onBlur` on the list.
 */
export function useKeepFocus(scrollRef: RefObject<HTMLDivElement | null>) {
  const inside = useRef(false);
  // After every render: focus was inside and nothing has it now, so it was removed with an element.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || !inside.current) return;
    const active = document.activeElement;
    if (active === null || active === document.body) element.focus({ preventScroll: true });
  });
  return {
    onFocus: () => {
      inside.current = true;
    },
    onBlur: (event: FocusEvent) => {
      const target = event.target;
      const next = event.relatedTarget;
      if (next instanceof Node && event.currentTarget.contains(next)) return;
      if (next !== null) {
        inside.current = false;
        return;
      }
      // Focus went nowhere: a click outside on something that takes no focus (left for good),
      // or the focused element was removed (still ours: the effect above takes it back).
      queueMicrotask(() => {
        if (target.isConnected) inside.current = false;
      });
    },
  };
}
