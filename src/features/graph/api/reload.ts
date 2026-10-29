/**
 * Reloading the graph after the repository changed (a commit, checkout, fetch, ...), keeping the
 * selected commit selected even though its row number may have changed.
 */
import type { QueryClient } from "@tanstack/react-query";

import { select, useSelectionStore } from "@/features/selection";
import type { GraphSummary } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { graphKeys } from "./graph";

/**
 * Selects `row` in `repoPath`, or else HEAD, or else the first commit; clears the selection when
 * the graph shows no commits (a filter can hide HEAD, or everything).
 */
export function selectOrFallBack(repoPath: string, row: number | null, summary: GraphSummary) {
  const next = row ?? summary.headRow ?? (summary.rows > 0 ? 0 : null);
  if (next === null) useSelectionStore.getState().clear(repoPath);
  else select(repoPath, { kind: "commit", row: next });
}

/** The selected commit's row in `repoPath`, or null. */
export function selectedRowOf(repoPath: string): number | null {
  const selection = useSelectionStore.getState().selections[repoPath];
  return selection?.kind === "commit" ? selection.row : null;
}

/**
 * Makes `summary` the graph of session `repoId`, then lets `reselect` move the selection to
 * its new row. Text pages are keyed by the graph generation, so they start fresh; everything
 * else read from the graph (refs, stashes, commit details) is refetched.
 */
export async function showGraph(
  queryClient: QueryClient,
  repoId: number,
  summary: GraphSummary,
  reselect: () => void,
): Promise<void> {
  queryClient.setQueryData(graphKeys.summary(repoId), summary);
  reselect();
  await queryClient.invalidateQueries({
    queryKey: graphKeys.all(repoId),
    predicate: (query) => query.queryKey[2] !== "summary",
  });
}

/** Rebuilds the graph of session `repoId` if it has been loaded. */
export async function reloadGraph(
  queryClient: QueryClient,
  repoId: number,
  repoPath: string,
): Promise<void> {
  const previous = queryClient.getQueryData<GraphSummary>(graphKeys.summary(repoId));
  if (!previous) return;
  const selectedRow = selectedRowOf(repoPath);
  const { summary, row } = await unwrap(commands.reloadGraph(repoId, selectedRow));
  await showGraph(queryClient, repoId, summary, () => {
    if (selectedRow === null) return;
    // Whoever was on HEAD follows it (to the commit just made); other selections stay on their
    // commit, or fall back to HEAD when it is gone (amended, rebased away).
    const followHead = selectedRow === previous.headRow;
    selectOrFallBack(repoPath, followHead ? summary.headRow : row, summary);
  });
}
