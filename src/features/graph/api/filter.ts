/** Changing what a repository tab shows (the filter bar). */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useSelectionStore } from "@/features/selection";
import type { GraphFilterDto } from "@/shared/ipc/bindings";
import { commands, toIpcError, unwrap } from "@/shared/ipc/client";

import { useGraphViewStore } from "../store/graphView";
import { selectOrFallBack, selectedRowOf, showGraph } from "./reload";

/** Every commit of every reference. */
export const NO_FILTER: GraphFilterDto = {
  tips: { type: "all" },
  firstParent: false,
  noMerges: false,
  author: null,
  message: null,
  path: null,
};

function hasText(text: string | null | undefined): boolean {
  return (text ?? "").trim() !== "";
}

/** Whether `filter` hides any commits. */
export function isFiltered(filter: GraphFilterDto): boolean {
  return (
    filter.tips.type !== "all" ||
    filter.firstParent ||
    filter.noMerges ||
    hasText(filter.author) ||
    hasText(filter.message) ||
    hasText(filter.path)
  );
}

/**
 * Makes session `repoId` show only the commits changing `path` (relative to the top of the
 * working tree) before its tab first loads the graph: the folder or file a task window was
 * opened on. The filter bar shows it, so it can be cleared.
 */
export async function showOnlyPath(repoId: number, path: string): Promise<void> {
  await unwrap(commands.setGraphFilter(repoId, { ...NO_FILTER, path }, null));
}

/**
 * Shows a filter in the tab of session `repoId`. The selected commit stays selected when the
 * filter shows it; otherwise HEAD (or the first row) is selected and scrolled into view. A
 * filter replaced by a newer one before it was ready fails as cancelled, without a toast.
 */
export function useSetGraphFilter(repoId: number, repoPath: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { silent: true },
    onError: (error) => {
      const { code, message, hint } = toIpcError(error);
      if (code !== "CANCELLED") toast.error(message, { description: hint ?? undefined });
    },
    mutationFn: async (filter: GraphFilterDto) => {
      const selectedRow = selectedRowOf(repoPath);
      const { summary, row } = await unwrap(commands.setGraphFilter(repoId, filter, selectedRow));
      useGraphViewStore.getState().forgetScroll(repoPath);
      await showGraph(queryClient, repoId, summary, () => {
        const selection = useSelectionStore.getState().selections[repoPath];
        if (selection?.kind !== "commit" && selection !== undefined) return;
        selectOrFallBack(repoPath, row, summary);
      });
    },
  });
}
