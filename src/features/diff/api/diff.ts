/** The line diff of one file: a summary, then rows page by page. */
import { useQueries, useQuery } from "@tanstack/react-query";

import { commands, unwrap } from "@/shared/ipc/client";

import { DIFF_PAGE_ROWS } from "../lib/constants";

/** Pages that leave the screen are dropped after this long. */
const PAGE_GC_TIME_MS = 60_000;

/**
 * Keyed by blob ids, which name the contents: a diff never changes, so nothing here goes stale
 * and a graph reload does not touch it.
 */
export const diffKeys = {
  summary: (repoId: number, oldId: string | null, newId: string | null) =>
    ["diff", repoId, oldId, newId] as const,
  page: (repoId: number, oldId: string | null, newId: string | null, page: number) =>
    ["diff", repoId, oldId, newId, "page", page] as const,
};

/** Kind, counts and row count of the diff between two blobs (`null`: absent on that side). */
export function useFileDiff(
  repoId: number,
  oldId: string | null,
  newId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: diffKeys.summary(repoId, oldId, newId),
    queryFn: () => unwrap(commands.getFileDiff(repoId, oldId, newId)),
    staleTime: Infinity,
    enabled,
  });
}

/** The rows on the given pages of {@link DIFF_PAGE_ROWS} rows. */
export function useDiffPages(
  repoId: number,
  oldId: string | null,
  newId: string | null,
  pages: readonly number[],
) {
  return useQueries({
    queries: pages.map((page) => ({
      queryKey: diffKeys.page(repoId, oldId, newId, page),
      queryFn: () =>
        unwrap(commands.getDiffLines(repoId, oldId, newId, page * DIFF_PAGE_ROWS, DIFF_PAGE_ROWS)),
      staleTime: Infinity,
      gcTime: PAGE_GC_TIME_MS,
    })),
  });
}
