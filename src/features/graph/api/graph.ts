/** Backend access for the commit graph: summary, binary blocks and paged row text. */
import { useQueries, useQuery } from "@tanstack/react-query";

import { IPC_FAILURE, IpcError, commands, unwrap } from "@/shared/ipc/client";

import { PAGE_ROWS } from "../lib/constants";

/** Text pages that leave the screen are dropped after this long. */
const PAGE_GC_TIME_MS = 60_000;

export const graphKeys = {
  all: (repoId: number) => ["graph", repoId] as const,
  summary: (repoId: number) => ["graph", repoId, "summary"] as const,
  /** Pages of one graph build: row numbers differ between generations. */
  page: (repoId: number, generation: number, page: number) =>
    ["graph", repoId, "page", generation, page] as const,
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
export function useCommitPages(repoId: number, generation: number, pages: readonly number[]) {
  return useQueries({
    queries: pages.map((page) => ({
      queryKey: graphKeys.page(repoId, generation, page),
      queryFn: () => unwrap(commands.getCommitRows(repoId, page * PAGE_ROWS, PAGE_ROWS)),
      staleTime: Infinity,
      gcTime: PAGE_GC_TIME_MS,
    })),
  });
}

/** One encoded block. */
export async function fetchGraphBlock(repoId: number, block: number): Promise<ArrayBuffer> {
  return toArrayBuffer(await unwrap(commands.getGraphBlock(repoId, block)));
}

/** The highlight overlay of one block for the history of the commit on `row`. */
export async function fetchAncestryBlock(
  repoId: number,
  row: number,
  block: number,
): Promise<ArrayBuffer> {
  return toArrayBuffer(await unwrap(commands.getAncestryBlock(repoId, row, block)));
}

/** Tauri delivers raw command results as an `ArrayBuffer` (or a view of one). */
function toArrayBuffer(data: unknown): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  }
  throw new IpcError(IPC_FAILURE, "The graph block arrived in an unexpected format.");
}
