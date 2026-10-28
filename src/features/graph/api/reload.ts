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
 * Rebuilds the graph of session `repoId` if it has been loaded. Text pages are keyed by the
 * graph generation, so they start fresh; everything else read from the graph (refs, stashes,
 * commit details) is refetched.
 */
export async function reloadGraph(
  queryClient: QueryClient,
  repoId: number,
  repoPath: string,
): Promise<void> {
  const previous = queryClient.getQueryData<GraphSummary>(graphKeys.summary(repoId));
  if (!previous) return;
  const selection = useSelectionStore.getState().selections[repoPath];
  const selectedRow = selection?.kind === "commit" ? selection.row : null;
  const { summary, row } = await unwrap(commands.reloadGraph(repoId, selectedRow));
  queryClient.setQueryData(graphKeys.summary(repoId), summary);
  if (selectedRow !== null) {
    // Whoever was on HEAD follows it (to the commit just made); other selections stay on their
    // commit, or fall back to HEAD when it is gone (amended, rebased away).
    const followHead = selectedRow === previous.headRow;
    const next = followHead ? summary.headRow : (row ?? summary.headRow);
    if (next !== null) select(repoPath, { kind: "commit", row: next });
  }
  await queryClient.invalidateQueries({
    queryKey: graphKeys.all(repoId),
    predicate: (query) => query.queryKey[2] !== "summary",
  });
}
