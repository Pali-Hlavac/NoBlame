/** Paging for long virtualized lists whose rows are fetched in pages. */

/** The pages of `pageRows` rows covering rows `first..=last`, plus `margin` pages each side. */
export function pagesFor(
  first: number,
  last: number,
  pageRows: number,
  margin: number,
  pageCount: number,
): number[] {
  if (last < first || pageCount === 0) return [];
  const from = Math.max(0, Math.floor(first / pageRows) - margin);
  const to = Math.min(pageCount - 1, Math.floor(last / pageRows) + margin);
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}
