import { useRef, type KeyboardEvent, type WheelEvent } from "react";

import { InlineError } from "@/shared/components/InlineError";

import { useSplitDiffPages } from "../api/diff";
import { rowAt, useVirtualRows } from "../hooks/useVirtualRows";
import { ROW_HEIGHT_PX } from "../lib/constants";
import { gutterDigits } from "../lib/format";
import { REGION_CLASSES, type LinesProps } from "../lib/region";
import { SplitRow } from "./SplitRow";

/** Pixels the arrow keys move the text sideways. */
const ARROW_STEP_PX = 40;
/** Characters besides the text in each half: line number padding and the +/- marker. */
const HALF_CHROME_CH = 6;

/**
 * The side-by-side diff. Each half clips its text; one scroll bar below moves both halves
 * sideways together (shift + wheel, a trackpad or the arrow keys work too).
 */
export function SplitLines({ request, diff, count, label, viewport, scrollTop }: LinesProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const { first, last, pages, onScroll } = useVirtualRows(viewport, count, scrollTop);
  const results = useSplitDiffPages(request, pages);
  const failed = results.find((result) => result.error)?.error;
  const digits = gutterDigits(diff.oldLines, diff.newLines);

  // The longest line loaded so far sets how far the halves can scroll.
  let widest = 0;
  for (const result of results) {
    for (const line of result.data ?? []) {
      widest = Math.max(widest, line.left?.text.length ?? 0, line.right?.text.length ?? 0);
    }
  }

  const scrollSideways = (pixels: number): void => {
    if (barRef.current) barRef.current.scrollLeft += pixels;
  };
  const onWheel = (event: WheelEvent): void => {
    const pixels = event.deltaX || (event.shiftKey ? event.deltaY : 0);
    if (pixels) scrollSideways(pixels);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "ArrowLeft") scrollSideways(-ARROW_STEP_PX);
    else if (event.key === "ArrowRight") scrollSideways(ARROW_STEP_PX);
  };

  const rows = [];
  for (let index = first; index <= last; index++) {
    rows.push(
      <div
        key={index}
        className="absolute right-0 left-0"
        style={{ top: index * ROW_HEIGHT_PX, height: ROW_HEIGHT_PX }}
      >
        <SplitRow line={rowAt(results, pages, index)} digits={digits} />
      </div>,
    );
  }

  return (
    <>
      {failed !== undefined && <InlineError error={failed} className="m-2" />}
      {/* The keys and the wheel scroll the region sideways; it is focusable for that reason. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={viewport}
        role="region"
        aria-label={label}
        // A scrolling region must take focus so the keyboard can scroll it (WCAG 2.1.1).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className={`${REGION_CLASSES} overflow-x-hidden overflow-y-auto`}
        onScroll={onScroll}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        onMouseDown={(event) => {
          const half = event.target instanceof Element ? event.target.closest("[data-side]") : null;
          event.currentTarget.dataset.selecting = half?.getAttribute("data-side") ?? "";
        }}
      >
        <div style={{ height: count * ROW_HEIGHT_PX }}>{rows}</div>
      </div>
      <div
        ref={barRef}
        aria-hidden
        className="shrink-0 overflow-x-auto overflow-y-hidden font-mono text-xs"
        onScroll={(event) => {
          viewport.current?.style.setProperty(
            "--diff-scroll-x",
            `${event.currentTarget.scrollLeft}px`,
          );
        }}
      >
        <div
          className="h-px"
          style={{ width: `calc(${widest + digits + HALF_CHROME_CH}ch + 50%)` }}
        />
      </div>
    </>
  );
}
