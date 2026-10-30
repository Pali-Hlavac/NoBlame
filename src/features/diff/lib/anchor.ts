/**
 * Keeping the diff's place when the same file is compared again with other options: the line
 * in the middle of the view stays where it was on screen, like zooming in at that line.
 */
import type { DiffLineDto, LineSideDto, SplitLineDto } from "@/shared/ipc/bindings";

import { ROW_HEIGHT_PX } from "./constants";

/** Rows looked at below the middle one when it shows no line (a hunk header). */
const ANCHOR_SEARCH_ROWS = 50;

/** A line of the file, and where its row is on screen. */
export interface DiffAnchor {
  side: LineSideDto;
  /** 1-based. */
  line: number;
  /** From the top of the view to the top of the row. */
  offsetPx: number;
}

/** The line a row shows: the new version's when it has one. */
export function lineOfRow(
  row: DiffLineDto | SplitLineDto,
): { side: LineSideDto; line: number } | null {
  if ("kind" in row) {
    if (row.newLine !== null) return { side: "new", line: row.newLine };
    if (row.oldLine !== null) return { side: "old", line: row.oldLine };
    return null;
  }
  if (row.right) return { side: "new", line: row.right.line };
  if (row.left) return { side: "old", line: row.left.line };
  return null;
}

/**
 * The line in the middle of a view scrolled to `scrollTop` and `height` pixels high, from rows
 * looked up by index (`undefined` when not loaded); `null` when none is known.
 */
export function anchorAt(
  rowAt: (index: number) => DiffLineDto | SplitLineDto | undefined,
  scrollTop: number,
  height: number,
  count: number,
): DiffAnchor | null {
  const middle = Math.floor((scrollTop + height / 2) / ROW_HEIGHT_PX);
  const end = Math.min(count, middle + ANCHOR_SEARCH_ROWS);
  for (let index = middle; index < end; index++) {
    const row = rowAt(index);
    const line = row && lineOfRow(row);
    if (line) return { ...line, offsetPx: index * ROW_HEIGHT_PX - scrollTop };
  }
  return null;
}

/** The scroll position that puts `row` where the anchor's row was on screen. */
export function scrollTopFor(row: number, anchor: DiffAnchor): number {
  return Math.max(0, row * ROW_HEIGHT_PX - anchor.offsetPx);
}
