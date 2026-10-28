/**
 * Per-repository scroll position that survives switching tabs. Keyed by repository path,
 * because the session id changes when a repository is reopened. The selected commit lives in
 * the shared selection store (`features/selection`).
 */
import { create } from "zustand";

interface GraphViewState {
  scrollTop: Record<string, number>;
  rememberScroll: (repoPath: string, scrollTop: number) => void;
}

export const useGraphViewStore = create<GraphViewState>()((set) => ({
  scrollTop: {},
  rememberScroll: (repoPath, scrollTop) => {
    set((state) => ({ scrollTop: { ...state.scrollTop, [repoPath]: scrollTop } }));
  },
}));
