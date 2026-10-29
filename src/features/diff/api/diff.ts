/** The line diff of one file: a summary, then rows page by page, unified or side by side. */
import { useQueries, useQuery } from "@tanstack/react-query";

import type { DiffOptionsDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { DIFF_PAGE_ROWS } from "../lib/constants";

/** Pages that leave the screen are dropped after this long. */
const PAGE_GC_TIME_MS = 60_000;

/** Which diff: two blobs (`null` when the file is absent on that side) and the options. */
export interface DiffRequest {
  repoId: number;
  oldId: string | null;
  newId: string | null;
  options: DiffOptionsDto;
}

/**
 * Keyed by blob ids, which name the contents, and the options: a diff never changes, so nothing
 * here goes stale and a graph reload does not touch it.
 */
export const diffKeys = {
  summary: ({ repoId, oldId, newId, options }: DiffRequest) =>
    ["diff", repoId, oldId, newId, options.whitespace, options.context] as const,
  page: (request: DiffRequest, layout: "unified" | "split", page: number) =>
    [...diffKeys.summary(request), layout, page] as const,
};

/** Kind, counts and row counts of a diff. */
export function useFileDiff(request: DiffRequest, enabled = true) {
  const { repoId, oldId, newId, options } = request;
  return useQuery({
    queryKey: diffKeys.summary(request),
    queryFn: () => unwrap(commands.getFileDiff(repoId, oldId, newId, options)),
    staleTime: Infinity,
    enabled,
  });
}

/** Unified rows on the given pages of {@link DIFF_PAGE_ROWS} rows. */
export function useDiffPages(request: DiffRequest, pages: readonly number[]) {
  const { repoId, oldId, newId, options } = request;
  return useQueries({
    queries: pages.map((page) => ({
      queryKey: diffKeys.page(request, "unified", page),
      queryFn: () =>
        unwrap(
          commands.getDiffLines(
            repoId,
            oldId,
            newId,
            options,
            page * DIFF_PAGE_ROWS,
            DIFF_PAGE_ROWS,
          ),
        ),
      staleTime: Infinity,
      gcTime: PAGE_GC_TIME_MS,
    })),
  });
}

/** Side-by-side rows on the given pages of {@link DIFF_PAGE_ROWS} rows. */
export function useSplitDiffPages(request: DiffRequest, pages: readonly number[]) {
  const { repoId, oldId, newId, options } = request;
  return useQueries({
    queries: pages.map((page) => ({
      queryKey: diffKeys.page(request, "split", page),
      queryFn: () =>
        unwrap(
          commands.getSplitDiffLines(
            repoId,
            oldId,
            newId,
            options,
            page * DIFF_PAGE_ROWS,
            DIFF_PAGE_ROWS,
          ),
        ),
      staleTime: Infinity,
      gcTime: PAGE_GC_TIME_MS,
    })),
  });
}
