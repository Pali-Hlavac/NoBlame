/**
 * Submodules not on the commits their repository records ("new commits"), for the bar that
 * offers to update them. The working tree status says which (the watcher keeps it current);
 * the submodule list gives their commits, which name the state the user dismissed.
 */
import type { SubmoduleDto, WorkingTreeStatusDto } from "@/shared/ipc/bindings";

/** Paths of the submodules whose checked-out commit is not the recorded one, sorted. */
export function driftedPaths(status: WorkingTreeStatusDto | null | undefined): string[] {
  if (!status) return [];
  return status.unstaged
    .filter((file) => file.submodule && file.submoduleChanges?.newCommits === true)
    .map((file) => file.path)
    .sort();
}

/**
 * Names this state: the paths with their recorded and checked-out commits (when the list knows
 * them). A pull or checkout that records other commits makes another key, so a dismissed bar
 * shows again.
 */
export function driftKey(paths: readonly string[], submodules: readonly SubmoduleDto[]): string {
  return paths
    .map((path) => {
      const known = submodules.find((submodule) => submodule.path === path);
      return `${path}@${known?.recorded ?? "?"}>${known?.checkedOut ?? "?"}`;
    })
    .join("|");
}

/** "libs/core is", "2 submodules are": the start of the bar's sentence. */
export function driftSubject(paths: readonly string[]): string {
  return paths.length === 1 ? `${paths[0] ?? ""} is` : `${paths.length} submodules are`;
}
