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
