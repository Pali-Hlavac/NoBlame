import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

import { shortId } from "../lib/format";

/** Offset of the hint from the pointer, so it does not cover the row under it. */
const OFFSET_PX = { x: 14, y: 18 } as const;
/** Widest hint; beyond the window's right edge it is drawn left of the pointer instead. */
const MAX_WIDTH_PX = 360;

interface Pointer {
  x: number;
  y: number;
  /** Display index of the row under the pointer (`data-index`). */
  index: number;
}

/** The row under the pointer while Ctrl (Cmd) is held over `target`, else `null`. */
function useModifiedPointer(target: RefObject<HTMLElement | null>): Pointer | null {
  const [held, setHeld] = useState(false);
  const [pointer, setPointer] = useState<Pointer | null>(null);
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const onKey = (event: KeyboardEvent): void => {
      setHeld(event.ctrlKey || event.metaKey);
    };
    const release = (): void => {
      setHeld(false);
    };
    const onMove = (event: MouseEvent): void => {
      setHeld(event.ctrlKey || event.metaKey);
      const row = event.target instanceof Element ? event.target.closest("[data-index]") : null;
      const index = row instanceof HTMLElement ? Number(row.dataset.index) : Number.NaN;
      setPointer(Number.isNaN(index) ? null : { x: event.clientX, y: event.clientY, index });
    };
    const onLeave = (): void => {
      setPointer(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", release);
    element.addEventListener("mousemove", onMove);
    element.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", release);
      element.removeEventListener("mousemove", onMove);
      element.removeEventListener("mouseleave", onLeave);
    };
  }, [target]);
  return held ? pointer : null;
}

interface CompareHintProps {
  /** The commit list; the hint follows the pointer over it. */
  target: RefObject<HTMLElement | null>;
  /** The selected commit (display index, and its text once loaded); none: no hint. */
  selected: { index: number; id?: string; summary?: string } | undefined;
  /** Whether Ctrl+click on this display index compares (a commit row). */
  isCommit: (index: number) => boolean;
}

/**
 * While Ctrl (Cmd on macOS) is held over another commit, a label at the pointer says that a
 * click compares it with the selected commit. It re-renders on its own, not the whole list.
 */
export function CompareHint({ target, selected, isCommit }: CompareHintProps) {
  const pointer = useModifiedPointer(target);
  if (!pointer || !selected || pointer.index === selected.index || !isCommit(pointer.index)) {
    return null;
  }
  const flip = pointer.x + OFFSET_PX.x + MAX_WIDTH_PX > window.innerWidth;
  const other = selected.id
    ? `${shortId(selected.id)} ${selected.summary ?? ""}`
    : "the selected commit";
  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed z-50 truncate rounded-md bg-foreground px-2 py-1 text-xs text-background shadow"
      style={{
        top: pointer.y + OFFSET_PX.y,
        left: flip ? undefined : pointer.x + OFFSET_PX.x,
        right: flip ? window.innerWidth - pointer.x + OFFSET_PX.x : undefined,
        maxWidth: MAX_WIDTH_PX,
      }}
    >
      Click to compare with {other}
    </div>,
    document.body,
  );
}
