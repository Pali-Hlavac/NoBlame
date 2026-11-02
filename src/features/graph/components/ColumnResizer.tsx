import { useRef, type KeyboardEvent, type PointerEvent } from "react";

import { MAX_COLUMN_WIDTH_PX, MIN_COLUMN_WIDTH_PX } from "@/features/settings";
import { cn } from "@/shared/lib/cn";

/** Pixels an arrow key widens or narrows a column by. */
const KEY_STEP_PX = 8;

const clamp = (width: number): number =>
  Math.round(Math.min(Math.max(width, MIN_COLUMN_WIDTH_PX), MAX_COLUMN_WIDTH_PX));

interface ColumnResizerProps {
  title: string;
  /** The last column: the handle stays inside it, clear of the column menu button. */
  last: boolean;
  widthPx: number;
  /** While dragging: the width to show. */
  onPreview: (widthPx: number) => void;
  /** The width to save; `null` puts the column back to its default. */
  onResize: (widthPx: number | null) => void;
}

/**
 * The right edge of a column title: drag it, or focus it and press the arrow keys, to change
 * the width; double-click it (or press Delete) for the default width.
 */
export function ColumnResizer({ title, last, widthPx, onPreview, onResize }: ColumnResizerProps) {
  const drag = useRef<{ startX: number; startWidth: number; width: number } | null>(null);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: widthPx, width: widthPx };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    current.width = clamp(current.startWidth + event.clientX - current.startX);
    onPreview(current.width);
  };
  const onPointerUp = () => {
    const current = drag.current;
    drag.current = null;
    if (current && current.width !== current.startWidth) onResize(current.width);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowLeft: -KEY_STEP_PX, ArrowRight: KEY_STEP_PX }[event.key];
    if (step !== undefined) onResize(clamp(widthPx + step));
    else if (event.key === "Delete" || event.key === "Backspace") onResize(null);
    else return;
    event.preventDefault();
  };
  // A focusable separator is ARIA's window splitter pattern; jsx-a11y counts separators as
  // static, so its two rules are switched off for this element.
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Width of the ${title} column`}
      aria-valuenow={widthPx}
      aria-valuemin={MIN_COLUMN_WIDTH_PX}
      aria-valuemax={MAX_COLUMN_WIDTH_PX}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      title="Drag to resize; double-click for the default width"
      // Centred in the gap after the column.
      className={cn(
        "absolute top-0 z-10 h-full w-2 cursor-col-resize rounded-sm outline-none after:absolute after:inset-y-1.5 after:left-[3px] after:w-px after:bg-border hover:after:bg-primary focus-visible:ring-2 focus-visible:ring-ring",
        last ? "right-0" : "-right-2.5",
      )}
      draggable={false}
      onDragStart={(event) => {
        event.preventDefault();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => {
        onResize(null);
      }}
      onKeyDown={onKeyDown}
    />
  );
}
