/** Backend access for the commit graph: summary, binary blocks and paged row text. */
import { useQueries, useQuery } from "@tanstack/react-query";

import { IPC_FAILURE, IpcError, commands, unwrap } from "@/shared/ipc/client";

import { PAGE_ROWS } from "../lib/constants";

/** Text pages that leave the screen are dropped after this long. */
const PAGE_GC_TIME_MS = 60_000;

export const graphKeys = {
  all: (repoId: number) => ["graph", repoId] as const,
  summary: (repoId: number) => ["graph", repoId, "summary"] as const,
  page: (repoId: number, page: number) => ["graph", repoId, "page", page] as const,
};

/** Builds the graph on first use (cached by the backend afterwards). */
export function useGraphSummary(repoId: number) {
  return useQuery({
    queryKey: graphKeys.summary(repoId),
    queryFn: () => unwrap(commands.loadGraph(repoId, false)),
    staleTime: Infinity,
  });
}

/** Text of the rows on the given pages of {@link PAGE_ROWS} rows. */
export function useCommitPages(repoId: number, pages: readonly number[]) {
  return useQueries({
    queries: pages.map((page) => ({
      queryKey: graphKeys.page(repoId, page),
      queryFn: () => unwrap(commands.getCommitRows(repoId, page * PAGE_ROWS, PAGE_ROWS)),
      staleTime: Infinity,
      gcTime: PAGE_GC_TIME_MS,
    })),
  });
}

/** One encoded block. Tauri delivers raw command results as an `ArrayBuffer`. */
export async function fetchGraphBlock(repoId: number, block: number): Promise<ArrayBuffer> {
  const data = await unwrap(commands.getGraphBlock(repoId, block));
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  }
  throw new IpcError(IPC_FAILURE, "The graph block arrived in an unexpected format.");
}
