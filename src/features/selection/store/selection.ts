/**
 * The selection shared by the workbench: which commit is selected in each repository. The
 * commit graph writes it; modules (Commit details, later Changed files and the diff tab) read
 * it, and can change it too (jump to a parent or to a branch's commit). Keyed by repository
 * path, because the session id changes when a repository is reopened.
 */
import { create } from "zustand";

interface SelectionState {
  /** Selected graph row per repository path. */
  rows: Record<string, number>;
  selectRow: (repoPath: string, row: number) => void;
  clear: (repoPath: string) => void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  rows: {},
  selectRow: (repoPath, row) => {
    set((state) =>
      state.rows[repoPath] === row ? state : { rows: { ...state.rows, [repoPath]: row } },
    );
  },
  clear: (repoPath) => {
    set((state) => {
      if (!(repoPath in state.rows)) return state;
      const rows = Object.fromEntries(
        Object.entries(state.rows).filter(([path]) => path !== repoPath),
      );
      return { rows };
    });
  },
}));

/** The selected row of `repoPath`, if any. */
export function useSelectedRow(repoPath: string | undefined): number | undefined {
  return useSelectionStore((state) => (repoPath === undefined ? undefined : state.rows[repoPath]));
}

/** Selects `row` in `repoPath`; the graph scrolls it into view. */
export function selectRow(repoPath: string, row: number): void {
  useSelectionStore.getState().selectRow(repoPath, row);
}
