/** Text formatting for graph columns. */

/** Characters of the commit id shown in the hash column. */
export const SHORT_ID_LENGTH = 8;

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Local date and time of a commit, from seconds since the epoch (`null`: unknown). */
export function formatCommitDate(seconds: number | null): string {
  return seconds === null ? "" : dateFormat.format(new Date(seconds * 1000));
}

/** Abbreviated commit id. */
export function shortId(id: string): string {
  return id.slice(0, SHORT_ID_LENGTH);
}

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
