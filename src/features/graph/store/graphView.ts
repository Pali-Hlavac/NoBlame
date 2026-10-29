/**
 * Per-repository view state that survives switching tabs: the scroll position and whether the
 * highlight of the selected commit was dismissed (Esc). Keyed by repository path, because the
 * session id changes when a repository is reopened. The selected commit lives in the shared
 * selection store (`features/selection`).
 */
import { create } from "zustand";

interface GraphViewState {
  scrollTop: Record<string, number>;
  /** The selected row whose highlight was dismissed; selecting again brings it back. */
  dismissedHighlight: Record<string, number | undefined>;
  rememberScroll: (repoPath: string, scrollTop: number) => void;
  /** The next view of the repository scrolls to the selection (after a filter change). */
  forgetScroll: (repoPath: string) => void;
  dismissHighlight: (repoPath: string, row: number | undefined) => void;
}

export const useGraphViewStore = create<GraphViewState>()((set) => ({
  scrollTop: {},
  dismissedHighlight: {},
  rememberScroll: (repoPath, scrollTop) => {
    set((state) => ({ scrollTop: { ...state.scrollTop, [repoPath]: scrollTop } }));
  },
  forgetScroll: (repoPath) => {
    set((state) => ({
      scrollTop: Object.fromEntries(
        Object.entries(state.scrollTop).filter(([path]) => path !== repoPath),
      ),
    }));
  },
  dismissHighlight: (repoPath, row) => {
    set((state) => ({ dismissedHighlight: { ...state.dismissedHighlight, [repoPath]: row } }));
  },
}));
