/**
 * The stash shown in the Stash tab of each repository (by commit id: its `stash@{n}` changes
 * when stashes are made or dropped), the file whose diff it shows, the files chosen to apply,
 * and whether applying restores the staged changes too. Keyed by repository path.
 */
import { create } from "zustand";

export interface ShownStash {
  /** The stash commit's id. */
  id: string;
  /** The file whose diff is shown. */
  file?: string;
  /** Files chosen for "Apply chosen files" (`untracked:` prefixed for the untracked ones). */
  chosen: readonly string[];
}

interface ShownState {
  shown: Record<string, ShownStash | undefined>;
  /** Apply and Pop restore the staged changes too (`--index`). */
  restoreIndex: boolean;
}

export const useShownStashStore = create<ShownState>()(() => ({ shown: {}, restoreIndex: false }));

/** The stash shown for `repoPath`. */
export function useShownStash(repoPath: string): ShownStash | undefined {
  return useShownStashStore((state) => state.shown[repoPath]);
}

/** Shows the stash `id` (choosing nothing yet). */
export function showStash(repoPath: string, id: string): void {
  useShownStashStore.setState((state) => ({
    shown: { ...state.shown, [repoPath]: { id, chosen: [] } },
  }));
}

function change(repoPath: string, update: (shown: ShownStash) => Partial<ShownStash>): void {
  useShownStashStore.setState((state) => {
    const shown = state.shown[repoPath];
    return shown ? { shown: { ...state.shown, [repoPath]: { ...shown, ...update(shown) } } } : {};
  });
}

/** Shows the diff of `file` (a key from {@link fileKey}). */
export function showStashFile(repoPath: string, file: string): void {
  change(repoPath, () => ({ file }));
}

/** Chooses or unchooses files for applying. */
export function chooseStashFiles(repoPath: string, keys: readonly string[], chosen: boolean): void {
  change(repoPath, (shown) => ({
    chosen: chosen
      ? [...new Set([...shown.chosen, ...keys])]
      : shown.chosen.filter((key) => !keys.includes(key)),
  }));
}

/** Forgets the shown stash (after it was dropped or popped). */
export function forgetStash(repoPath: string, id: string): void {
  useShownStashStore.setState((state) =>
    state.shown[repoPath]?.id === id ? { shown: { ...state.shown, [repoPath]: undefined } } : {},
  );
}

/** Whether Apply and Pop restore the staged changes too. */
export function setRestoreIndex(restoreIndex: boolean): void {
  useShownStashStore.setState({ restoreIndex });
}

/** The key of a stash's file: untracked files can share a path with a tracked one. */
export function fileKey(path: string, untracked: boolean): string {
  return untracked ? `untracked:${path}` : path;
}
