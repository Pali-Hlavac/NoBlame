/**
 * Maps the scroll position onto rows. Up to {@link MAX_SCROLL_HEIGHT_PX} the scroll area is
 * as tall as the rows; beyond it the scroll position is scaled, so a million rows still fit
 * the browser's height limits.
 */
import { MAX_SCROLL_HEIGHT_PX, ROW_HEIGHT_PX } from "./constants";

export interface Viewport {
  /** Height of the scrollable spacer. */
  spacerHeight: number;
  /** Top of the visible window in row coordinates (pixels from row 0). */
  virtualTop: number;
  /** First and last (inclusive) rows at least partly visible. */
  firstRow: number;
  lastRow: number;
}

export function computeViewport(
  scrollTop: number,
  viewportHeight: number,
  rowCount: number,
): Viewport {
  const contentHeight = rowCount * ROW_HEIGHT_PX;
  const spacerHeight = Math.min(contentHeight, MAX_SCROLL_HEIGHT_PX);
  const virtualTop = clamp(
    scrollTop * scale(contentHeight, spacerHeight, viewportHeight),
    0,
    Math.max(0, contentHeight - viewportHeight),
  );
  const firstRow = Math.floor(virtualTop / ROW_HEIGHT_PX);
  const lastRow = Math.min(rowCount - 1, Math.floor((virtualTop + viewportHeight) / ROW_HEIGHT_PX));
  return { spacerHeight, virtualTop, firstRow, lastRow };
}

/** The scroll position that puts `row` at the top (or as close as possible). */
export function scrollTopForRow(row: number, viewportHeight: number, rowCount: number): number {
  const contentHeight = rowCount * ROW_HEIGHT_PX;
  const spacerHeight = Math.min(contentHeight, MAX_SCROLL_HEIGHT_PX);
  return (row * ROW_HEIGHT_PX) / scale(contentHeight, spacerHeight, viewportHeight);
}

/**
 * A row hidden by less than this still counts as visible. At fractional display scaling the
 * browser's scroll position and `clientHeight` are rounded differently, so the last row can
 * seem a fraction of a pixel short of the bottom even when scrolled to the end.
 */
const REVEAL_TOLERANCE_PX = 1;

/** The scroll position that makes `row` fully visible, moving as little as possible. */
export function scrollTopToReveal(
  row: number,
  scrollTop: number,
  viewportHeight: number,
  rowCount: number,
): number {
  const { virtualTop } = computeViewport(scrollTop, viewportHeight, rowCount);
  const rowTop = row * ROW_HEIGHT_PX;
  if (rowTop < virtualTop - REVEAL_TOLERANCE_PX) {
    return scrollTopForRow(row, viewportHeight, rowCount);
  }
  const rowBottom = rowTop + ROW_HEIGHT_PX;
  if (rowBottom > virtualTop + viewportHeight + REVEAL_TOLERANCE_PX) {
    // The row's bottom edge on the window's bottom edge.
    const contentHeight = rowCount * ROW_HEIGHT_PX;
    const spacerHeight = Math.min(contentHeight, MAX_SCROLL_HEIGHT_PX);
    return (rowBottom - viewportHeight) / scale(contentHeight, spacerHeight, viewportHeight);
  }
  return scrollTop;
}

/** Virtual pixels per scrolled pixel (1 unless the content is taller than the cap). */
function scale(contentHeight: number, spacerHeight: number, viewportHeight: number): number {
  const scrollable = spacerHeight - viewportHeight;
  if (contentHeight <= spacerHeight || scrollable <= 0) return 1;
  return (contentHeight - viewportHeight) / scrollable;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
