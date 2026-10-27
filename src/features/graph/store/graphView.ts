/**
 * Per-repository view state that survives switching tabs: selected row and scroll position.
 * Keyed by repository path, because the session id changes when a repository is reopened.
 */
import { create } from "zustand";

interface GraphViewState {
  selected: Record<string, number>;
  scrollTop: Record<string, number>;
  select: (repoPath: string, row: number) => void;
  rememberScroll: (repoPath: string, scrollTop: number) => void;
}

export const useGraphViewStore = create<GraphViewState>()((set) => ({
  selected: {},
  scrollTop: {},
  select: (repoPath, row) => {
    set((state) => ({ selected: { ...state.selected, [repoPath]: row } }));
  },
  rememberScroll: (repoPath, scrollTop) => {
    set((state) => ({ scrollTop: { ...state.scrollTop, [repoPath]: scrollTop } }));
  },
}));
