/**
 * The selection shared by the workbench: what is selected in each repository. That is a commit
 * (its graph row) or one of the working tree rows above the commits. The commit graph writes it;
 * modules (Commit details, later Changed files and the diff tab) read it, and can change it too
 * (jump to a parent or to a branch's commit). Keyed by repository path, because the session id
 * changes when a repository is reopened.
 */
import { create } from "zustand";

/** A commit, the working tree changes, or the staged changes ("index"). */
export type Selection = { kind: "commit"; row: number } | { kind: "worktree" } | { kind: "index" };

/** A file of the selected commit, chosen in the Changed files module (shown by the diff tab). */
export interface SelectedFile {
  path: string;
  previousPath: string | null;
  /** Blob ids before and after (hex); `null` when added or deleted. */
  oldId: string | null;
  newId: string | null;
}

interface SelectionState {
  selections: Record<string, Selection>;
  /** The file chosen in each repository; cleared whenever the selection changes. */
  files: Record<string, SelectedFile | undefined>;
  select: (repoPath: string, selection: Selection) => void;
  selectFile: (repoPath: string, file: SelectedFile | undefined) => void;
  clear: (repoPath: string) => void;
}

function same(a: Selection | undefined, b: Selection): boolean {
  if (a?.kind !== b.kind) return false;
  return a.kind !== "commit" || (b.kind === "commit" && a.row === b.row);
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selections: {},
  files: {},
  select: (repoPath, selection) => {
    set((state) =>
      same(state.selections[repoPath], selection)
        ? state
        : {
            selections: { ...state.selections, [repoPath]: selection },
            files: { ...state.files, [repoPath]: undefined },
          },
    );
  },
  selectFile: (repoPath, file) => {
    set((state) => ({ files: { ...state.files, [repoPath]: file } }));
  },
  clear: (repoPath) => {
    set((state) => {
      if (!(repoPath in state.selections)) return state;
      const selections = Object.fromEntries(
        Object.entries(state.selections).filter(([path]) => path !== repoPath),
      );
      return { selections, files: { ...state.files, [repoPath]: undefined } };
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

/** The file chosen in `repoPath`'s Changed files module, if any. */
export function useSelectedFile(repoPath: string | undefined): SelectedFile | undefined {
  return useSelectionStore((state) => (repoPath === undefined ? undefined : state.files[repoPath]));
}

/** Chooses a file of the selected commit (or none). */
export function selectFile(repoPath: string, file: SelectedFile | undefined): void {
  useSelectionStore.getState().selectFile(repoPath, file);
}

/** Selects anything, including a working tree row. */
export function select(repoPath: string, selection: Selection): void {
  useSelectionStore.getState().select(repoPath, selection);
}
