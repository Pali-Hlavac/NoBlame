/**
 * The selection shared by the workbench: what is selected in each repository. That is a commit
 * (its graph row) or one of the working tree rows above the commits, plus the file chosen in
 * Changed files and the parent a merge is compared with. The commit graph writes the selection;
 * modules (Commit details, Changed files, the diff tab) read it and can change it too (jump to a
 * parent or to a branch's commit). Keyed by repository path, because the session id changes
 * when a repository is reopened.
 */
import { create } from "zustand";

/** A commit, the working tree changes, or the staged changes ("index"). */
export type Selection = { kind: "commit"; row: number } | { kind: "worktree" } | { kind: "index" };

interface SelectionState {
  selections: Record<string, Selection>;
  /**
   * Path of the file chosen in each repository. It stays when another commit is selected, so
   * the diff tab shows the same file there if that commit changed it too.
   */
  files: Record<string, string | undefined>;
  /** Parent a merge is compared with (0 = first); back to 0 when the selection changes. */
  parents: Record<string, number | undefined>;
  select: (repoPath: string, selection: Selection) => void;
  selectFile: (repoPath: string, path: string | undefined) => void;
  compareWithParent: (repoPath: string, parent: number) => void;
  clear: (repoPath: string) => void;
}

function same(a: Selection | undefined, b: Selection): boolean {
  if (a?.kind !== b.kind) return false;
  return a.kind !== "commit" || (b.kind === "commit" && a.row === b.row);
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selections: {},
  files: {},
  parents: {},
  select: (repoPath, selection) => {
    set((state) =>
      same(state.selections[repoPath], selection)
        ? state
        : {
            selections: { ...state.selections, [repoPath]: selection },
            parents: { ...state.parents, [repoPath]: undefined },
          },
    );
  },
  selectFile: (repoPath, path) => {
    set((state) => ({ files: { ...state.files, [repoPath]: path } }));
  },
  compareWithParent: (repoPath, parent) => {
    set((state) => ({ parents: { ...state.parents, [repoPath]: parent } }));
  },
  clear: (repoPath) => {
    set((state) => {
      if (!(repoPath in state.selections) && state.files[repoPath] === undefined) return state;
      const selections = Object.fromEntries(
        Object.entries(state.selections).filter(([path]) => path !== repoPath),
      );
      return {
        selections,
        files: { ...state.files, [repoPath]: undefined },
        parents: { ...state.parents, [repoPath]: undefined },
      };
    });
  },
}));

/** What is selected in `repoPath`, if anything. */
export function useSelection(repoPath: string | undefined): Selection | undefined {
  return useSelectionStore((state) =>
    repoPath === undefined ? undefined : state.selections[repoPath],
  );
}

/** The selected commit's row in `repoPath`; undefined when nothing or a working tree row is. */
export function useSelectedRow(repoPath: string | undefined): number | undefined {
  return useSelectionStore((state) => {
    const selection = repoPath === undefined ? undefined : state.selections[repoPath];
    return selection?.kind === "commit" ? selection.row : undefined;
  });
}

/** Selects the commit on `row` in `repoPath`; the graph scrolls it into view. */
export function selectRow(repoPath: string, row: number): void {
  useSelectionStore.getState().select(repoPath, { kind: "commit", row });
}

/** Path of the file chosen in `repoPath`'s Changed files module, if any. */
export function useSelectedFile(repoPath: string | undefined): string | undefined {
  return useSelectionStore((state) => (repoPath === undefined ? undefined : state.files[repoPath]));
}

/** Chooses a file by path (or none); the diff tab shows it. */
export function selectFile(repoPath: string, path: string | undefined): void {
  useSelectionStore.getState().selectFile(repoPath, path);
}

/** The parent the selected commit is compared with (0 = first parent). */
export function useComparedParent(repoPath: string | undefined): number {
  return useSelectionStore((state) =>
    repoPath === undefined ? 0 : (state.parents[repoPath] ?? 0),
  );
}

/** Compares the selected merge with its parent number `parent` (0 = first). */
export function compareWithParent(repoPath: string, parent: number): void {
  useSelectionStore.getState().compareWithParent(repoPath, parent);
}

/** Selects anything, including a working tree row. */
export function select(repoPath: string, selection: Selection): void {
  useSelectionStore.getState().select(repoPath, selection);
}
