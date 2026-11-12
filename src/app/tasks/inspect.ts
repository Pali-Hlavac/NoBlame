/** Readying Blame and File history windows (M8 slice 3). */
import { showBlame } from "@/features/blame";
import { goToCommit } from "@/features/graph";
import { showHistory } from "@/features/history";
import { IpcError } from "@/shared/ipc/client";

import type { TaskTarget } from "./specs";

/**
 * Blames the file the window was opened on, as it is in `HEAD`. A folder, or a path outside
 * the working tree, cannot be blamed: the window says so.
 */
export async function blameScopedFile({ path, summary, scope }: TaskTarget): Promise<void> {
  if (!scope?.relative || scope.isFolder) {
    throw new IpcError(
      "INVALID_INPUT",
      "Blame shows the lines of a file, and this is a folder.",
      "Open Blame on a file, or File history on this folder.",
    );
  }
  const head = await goToCommit(summary.id, "HEAD");
  showBlame(path, { commit: head.id, path: scope.relative });
}

/** Shows the history of the file or folder the window was opened on (none for the top). */
export function showScopedHistory({ path, scope }: TaskTarget): void {
  if (scope?.relative) showHistory(path, { path: scope.relative, folder: scope.isFolder });
}
