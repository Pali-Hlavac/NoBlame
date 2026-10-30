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
  /**
   * Find bar per repository: 0 or missing when closed, otherwise a counter raised by every
   * request to open it, so a second Ctrl+F focuses it again.
   */
  findOpen: Record<string, number>;
  /** The repository whose "Go to commit" dialog is open. */
  goToOpen: string | null;
  setFindOpen: (repoPath: string, open: boolean) => void;
  setGoToOpen: (repoPath: string | null) => void;
  rememberScroll: (repoPath: string, scrollTop: number) => void;
  /** The next view of the repository scrolls to the selection (after a filter change). */
  forgetScroll: (repoPath: string) => void;
  dismissHighlight: (repoPath: string, row: number | undefined) => void;
}

export const useGraphViewStore = create<GraphViewState>()((set) => ({
  scrollTop: {},
  dismissedHighlight: {},
  findOpen: {},
  goToOpen: null,
  setFindOpen: (repoPath, open) => {
    set((state) => ({
      findOpen: { ...state.findOpen, [repoPath]: open ? (state.findOpen[repoPath] ?? 0) + 1 : 0 },
    }));
  },
  setGoToOpen: (repoPath) => {
    set({ goToOpen: repoPath });
  },
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
