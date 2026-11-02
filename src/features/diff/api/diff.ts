/** The line diff of one file: a summary, then rows page by page, unified or side by side. */
import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";

import type { DiffLayout, DiffRequestDto, LineSideDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { DIFF_PAGE_ROWS } from "../lib/constants";

/** Pages that leave the screen are dropped after this long. */
const PAGE_GC_TIME_MS = 60_000;

/**
 * Which diff: two blobs (`null` when the file is absent on that side), the file's path (its
 * `.gitattributes` decide between text and binary) and the options. With `worktree`, the new
 * side is the working tree file at the path, and `newId` the id it would have as a blob.
 */
export interface DiffRequest extends DiffRequestDto {
  repoId: number;
}

/**
 * Keyed by blob ids, which name the contents, and the options: a diff never changes, so nothing
 * here goes stale and a graph reload does not touch it. A working tree file is named by the id
 * it would have as a blob, so a new version of it is another key.
 */
export const diffKeys = {
  summary: ({ repoId, oldId, newId, path, options }: DiffRequest) =>
    [
      "diff",
      repoId,
      oldId,
      newId,
      path,
      options.whitespace,
      options.context,
      options.syntax,
    ] as const,
  page: (request: DiffRequest, layout: DiffLayout, page: number) =>
    [...diffKeys.summary(request), layout, page] as const,
};

/** The request as the commands take it (without the repository). */
function dto({ oldId, newId, path, options, worktree }: DiffRequest): DiffRequestDto {
  return { oldId, newId, path, options, worktree };
}

/** Kind, counts and row counts of a diff. */
export function useFileDiff(request: DiffRequest, enabled = true) {
  return useQuery({
    queryKey: diffKeys.summary(request),
    queryFn: () => unwrap(commands.getFileDiff(request.repoId, dto(request))),
    staleTime: Infinity,
    enabled,
  });
}

/** The query of one page of {@link DIFF_PAGE_ROWS} unified rows. */
export function unifiedPageQuery(request: DiffRequest, page: number) {
  return queryOptions({
    queryKey: diffKeys.page(request, "unified", page),
    queryFn: () =>
      unwrap(
        commands.getDiffLines(request.repoId, dto(request), page * DIFF_PAGE_ROWS, DIFF_PAGE_ROWS),
      ),
    staleTime: Infinity,
    gcTime: PAGE_GC_TIME_MS,
  });
}

/** The query of one page of {@link DIFF_PAGE_ROWS} side-by-side rows. */
export function splitPageQuery(request: DiffRequest, page: number) {
  return queryOptions({
    queryKey: diffKeys.page(request, "split", page),
    queryFn: () =>
      unwrap(
        commands.getSplitDiffLines(
          request.repoId,
          dto(request),
          page * DIFF_PAGE_ROWS,
          DIFF_PAGE_ROWS,
        ),
      ),
    staleTime: Infinity,
    gcTime: PAGE_GC_TIME_MS,
  });
}

/** Unified rows on the given pages of {@link DIFF_PAGE_ROWS} rows. */
export function useDiffPages(request: DiffRequest, pages: readonly number[]) {
  return useQueries({ queries: pages.map((page) => unifiedPageQuery(request, page)) });
}

/** Side-by-side rows on the given pages of {@link DIFF_PAGE_ROWS} rows. */
export function useSplitDiffPages(request: DiffRequest, pages: readonly number[]) {
  return useQueries({ queries: pages.map((page) => splitPageQuery(request, page)) });
}

/**
 * The row of `layout` showing line `line` of `side` (or the nearest line shown); `null` when
 * the diff has no rows.
 */
export function findDiffRow(
  request: DiffRequest,
  layout: DiffLayout,
  side: LineSideDto,
  line: number,
): Promise<number | null> {
  return unwrap(commands.findDiffRow(request.repoId, dto(request), layout, side, line));
}
