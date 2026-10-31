/** Pure helpers for the rows of a history. */
import type { FileHistoryRowDto, PathChangeDto } from "@/shared/ipc/bindings";

import { HISTORY_PAGE_ROWS } from "../api/history";

/** One-letter code and word for what a commit did to the path ("" for merges). */
export const CHANGE_LABELS: Readonly<Record<PathChangeDto, { letter: string; word: string }>> = {
  added: { letter: "A", word: "added" },
  modified: { letter: "M", word: "modified" },
  deleted: { letter: "D", word: "deleted" },
  renamed: { letter: "R", word: "renamed" },
  merge: { letter: "", word: "merge" },
};

/** The commit at position `index`, from page results fetched for `pages`. */
export function entryAt(
  results: readonly { data?: readonly FileHistoryRowDto[] | undefined }[],
  pages: readonly number[],
  index: number,
): FileHistoryRowDto | undefined {
  const page = results[pages.indexOf(Math.floor(index / HISTORY_PAGE_ROWS))];
  return page?.data?.[index % HISTORY_PAGE_ROWS];
}

/** Position of the commit on graph row `row` among the fetched pages, if fetched. */
export function indexOfRow(
  results: readonly { data?: readonly FileHistoryRowDto[] | undefined }[],
  pages: readonly number[],
  row: number | undefined,
): number | undefined {
  if (row === undefined) return undefined;
  for (const [position, result] of results.entries()) {
    const found = result.data?.findIndex((entry) => entry.row === row) ?? -1;
    const page = pages[position];
    if (found >= 0 && page !== undefined) return page * HISTORY_PAGE_ROWS + found;
  }
  return undefined;
}

/** Accessible description of one commit, e.g. "Fix the parser, Ada, 3 May 2024, renamed". */
export function describeEntry(entry: FileHistoryRowDto, date: string): string {
  const parts = [entry.summary, entry.authorName, date, CHANGE_LABELS[entry.change].word];
  if (entry.previousPath) parts.push(`from ${entry.previousPath}`);
  if (entry.row === null) parts.push("hidden by the graph's filter");
  return parts.join(", ");
}
