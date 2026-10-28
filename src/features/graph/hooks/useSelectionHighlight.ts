import { useAppSettings } from "@/features/settings";

import { useGraphViewStore } from "../store/graphView";
import { useAncestryCache } from "./useAncestryCache";

/**
 * The highlight of the selected commit: its history in the graph and its author's commits.
 * On unless switched off in Settings or dismissed with Esc (until the next selection).
 */
export function useSelectionHighlight(repoId: number, repoPath: string, selected?: number) {
  const enabled = useAppSettings().graph.highlightSelection;
  const dismissed = useGraphViewStore((state) => state.dismissedHighlight[repoPath]);
  const row = enabled && selected !== dismissed ? selected : undefined;
  const { cache, version } = useAncestryCache(repoId, row);
  return {
    /** The highlighted row, or undefined when nothing is highlighted. */
    row,
    cache,
    version,
    dismiss: () => {
      useGraphViewStore.getState().dismissHighlight(repoPath, selected);
    },
    /** Called on every selection made in the graph, so selecting the same row again shows it. */
    restore: () => {
      useGraphViewStore.getState().dismissHighlight(repoPath, undefined);
    },
  };
}
