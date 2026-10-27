/** Keyboard navigation in the commit list. */

/**
 * The row selected after pressing `key`, or `null` if the key does not navigate.
 * `pageRows` is the number of fully visible rows.
 */
export function nextRow(
  key: string,
  current: number | undefined,
  rowCount: number,
  pageRows: number,
): number | null {
  if (rowCount === 0) return null;
  const last = rowCount - 1;
  const from = current ?? -1;
  const step = Math.max(1, pageRows - 1);
  switch (key) {
    case "ArrowDown":
      return Math.min(last, from + 1);
    case "ArrowUp":
      return Math.max(0, from - 1);
    case "PageDown":
      return Math.min(last, from + step);
    case "PageUp":
      return Math.max(0, from - step);
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}
