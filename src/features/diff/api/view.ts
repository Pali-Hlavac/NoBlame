/** One version of a file shown whole: a summary, then its rows page by page. */
import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";

import type { FileViewRequestDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { DIFF_PAGE_ROWS } from "../lib/constants";

/** Pages that leave the screen are dropped after this long. */
const PAGE_GC_TIME_MS = 60_000;

/** Which file: its blob, its path (`.gitattributes` and language) and syntax colours. */
export interface FileViewRequest extends FileViewRequestDto {
  repoId: number;
}

/** Keyed by the blob, which names the contents: a view never changes. */
export const viewKeys = {
  summary: ({ repoId, blobId, path, syntax }: FileViewRequest) =>
    ["file-view", repoId, blobId, path, syntax] as const,
  page: (request: FileViewRequest, page: number) => [...viewKeys.summary(request), page] as const,
};

function dto({ blobId, path, syntax }: FileViewRequest): FileViewRequestDto {
  return { blobId, path, syntax };
}

/** Kind, size and row count of the file. */
export function useFileView(request: FileViewRequest) {
  return useQuery({
    queryKey: viewKeys.summary(request),
    queryFn: () => unwrap(commands.getFileView(request.repoId, dto(request))),
    staleTime: Infinity,
  });
}

function pageQuery(request: FileViewRequest, page: number) {
  return queryOptions({
    queryKey: viewKeys.page(request, page),
    queryFn: () =>
      unwrap(
        commands.getFileViewLines(
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

/** Rows on the given pages of {@link DIFF_PAGE_ROWS} rows. */
export function useFileViewPages(request: FileViewRequest, pages: readonly number[]) {
  return useQueries({ queries: pages.map((page) => pageQuery(request, page)) });
}
