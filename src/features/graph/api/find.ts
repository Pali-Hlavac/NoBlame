/** Finding commits in a repository tab, and "go to commit". */
import type { FoundCommit, GoToCommit } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { useGraphViewStore } from "../store/graphView";

/** Opens the find bar (Ctrl+F) of the repository tab of `repoPath`. */
export const FIND_HOTKEY = "mod+f";
/** Opens "Go to commit" (Ctrl+Shift+G, as in Git Extensions). */
export const GO_TO_HOTKEY = "mod+shift+g";

/** Opens the find bar of the repository at `repoPath`. */
export function openFind(repoPath: string): void {
  useGraphViewStore.getState().setFindOpen(repoPath, true);
}

/** Opens the "Go to commit" dialog of the repository at `repoPath`. */
export function openGoTo(repoPath: string): void {
  useGraphViewStore.getState().setGoToOpen(repoPath);
}

/**
 * The match of `query` after row `from` (before it when `backwards`), wrapping around; the
 * first (or last) match when `from` is null. Fails as CANCELLED when a newer search replaced it.
 */
export function findCommit(
  repoId: number,
  query: string,
  from: number | null,
  backwards: boolean,
): Promise<FoundCommit> {
  return unwrap(commands.findCommit(repoId, query, from, backwards));
}

/** The commit a revision names (id, branch, tag, `HEAD~2`) and its row. */
export function goToCommit(repoId: number, revision: string): Promise<GoToCommit> {
  return unwrap(commands.goToCommit(repoId, revision));
}
