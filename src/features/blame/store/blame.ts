/**
 * What the blame tab shows in each repository: a file at a commit, and the versions blamed
 * before it, for **Back** after "blame the previous revision". It does not follow the selected
 * commit: clicking a line's commit selects that commit without blaming it. Keyed by
 * repository path, like the selection.
 */
import { create } from "zustand";

import { showBlameTab } from "@/features/workspace";

/** A file (path relative to the repository root) as it is in a commit (full id). */
export interface BlameTarget {
  commit: string;
  path: string;
}

interface BlameState {
  targets: Record<string, BlameTarget | undefined>;
  /** Versions blamed before the current one, the latest last. */
  back: Record<string, readonly BlameTarget[] | undefined>;
}

export const useBlameStore = create<BlameState>()(() => ({ targets: {}, back: {} }));

/** What the blame tab shows in `repoPath`. */
export function useBlameTarget(repoPath: string): BlameTarget | undefined {
  return useBlameStore((state) => state.targets[repoPath]);
}

/** Whether **Back** has a version to return to. */
export function useCanGoBack(repoPath: string): boolean {
  return useBlameStore((state) => (state.back[repoPath]?.length ?? 0) > 0);
}

/** Blames a file at a commit, starting a new trail for **Back**. */
export function showBlame(repoPath: string, target: BlameTarget): void {
  useBlameStore.setState((state) => ({
    targets: { ...state.targets, [repoPath]: target },
    back: { ...state.back, [repoPath]: [] },
  }));
  showBlameTab();
}

/** Blames the version before a change; **Back** returns to the current one. */
export function blamePrevious(repoPath: string, target: BlameTarget): void {
  useBlameStore.setState((state) => {
    const current = state.targets[repoPath];
    const back = state.back[repoPath] ?? [];
    return {
      targets: { ...state.targets, [repoPath]: target },
      back: { ...state.back, [repoPath]: current ? [...back, current] : back },
    };
  });
}

/** Returns to the version blamed before. */
export function goBack(repoPath: string): void {
  useBlameStore.setState((state) => {
    const back = state.back[repoPath] ?? [];
    const previous = back.at(-1);
    if (!previous) return state;
    return {
      targets: { ...state.targets, [repoPath]: previous },
      back: { ...state.back, [repoPath]: back.slice(0, -1) },
    };
  });
}
