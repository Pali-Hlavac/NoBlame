/**
 * The file or folder the history tab shows in each repository, chosen with "File history". It
 * stays when another commit is selected: a history is of a path, not of a commit. Keyed by
 * repository path, like the selection.
 */
import { create } from "zustand";

import { showHistoryTab } from "@/features/workspace";

/** A path relative to the repository root, and whether it is a folder. */
export interface HistoryTarget {
  path: string;
  folder: boolean;
}

interface HistoryState {
  targets: Record<string, HistoryTarget | undefined>;
}

export const useHistoryStore = create<HistoryState>()(() => ({ targets: {} }));

/** What the history tab shows in `repoPath`. */
export function useHistoryTarget(repoPath: string): HistoryTarget | undefined {
  return useHistoryStore((state) => state.targets[repoPath]);
}

/** Shows the history of a file or folder in the history tab. */
export function showHistory(repoPath: string, target: HistoryTarget): void {
  useHistoryStore.setState((state) => ({ targets: { ...state.targets, [repoPath]: target } }));
  showHistoryTab();
}
