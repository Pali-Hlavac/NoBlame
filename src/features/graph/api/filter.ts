/** Changing what a repository tab shows (the filter bar). */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSelectionStore } from "@/features/selection";
import type { GraphFilterDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { useGraphViewStore } from "../store/graphView";
import { selectOrFallBack, selectedRowOf, showGraph } from "./reload";

/** Every commit of every reference. */
export const NO_FILTER: GraphFilterDto = {
  tips: { type: "all" },
  firstParent: false,
  noMerges: false,
};

/** Whether `filter` hides any commits. */
export function isFiltered(filter: GraphFilterDto): boolean {
  return filter.tips.type !== "all" || filter.firstParent || filter.noMerges;
}

/**
 * Shows a filter in the tab of session `repoId`. The selected commit stays selected when the
 * filter shows it; otherwise HEAD (or the first row) is selected and scrolled into view.
 */
export function useSetGraphFilter(repoId: number, repoPath: string) {
  const queryClient = useQueryClient();
  return useMutation({
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
