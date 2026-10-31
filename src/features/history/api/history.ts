/** A path's history: its size and earlier names, then its commits page by page. */
import { useQueries, useQuery } from "@tanstack/react-query";

import { graphKeys } from "@/features/graph";
import { commands, unwrap } from "@/shared/ipc/client";

/** Commits fetched per request. */
export const HISTORY_PAGE_ROWS = 200;

/** Pages that leave the screen are dropped after this long. */
const PAGE_GC_TIME_MS = 60_000;

export const historyKeys = {
  /** Under the graph's keys: a reload or a filter change reads the history again. */
  summary: (repoId: number, path: string) => [...graphKeys.all(repoId), "history", path] as const,
  /** With the graph generation: the rows of the commits differ between generations. */
  page: (repoId: number, path: string, generation: number, page: number) =>
    [...historyKeys.summary(repoId, path), generation, page] as const,
};

/** How many commits change `path` and the names it had before. */
export function useFileHistory(repoId: number, path: string) {
  return useQuery({
    queryKey: historyKeys.summary(repoId, path),
    queryFn: () => unwrap(commands.getFileHistory(repoId, path)),
    staleTime: Infinity,
  });
}

/** The commits on the given pages of {@link HISTORY_PAGE_ROWS}, newest first. */
export function useHistoryPages(
  repoId: number,
  path: string,
  generation: number,
  pages: readonly number[],
) {
  return useQueries({
    queries: pages.map((page) => ({
      queryKey: historyKeys.page(repoId, path, generation, page),
      queryFn: () =>
        unwrap(
          commands.getFileHistoryRows(repoId, path, page * HISTORY_PAGE_ROWS, HISTORY_PAGE_ROWS),
        ),
      staleTime: Infinity,
      gcTime: PAGE_GC_TIME_MS,
    })),
  });
}
