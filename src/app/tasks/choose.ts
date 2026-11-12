/** Choosing the changes a Commit or Diff window opens with. */
import { select, selectFile } from "@/features/selection";
import { fetchStatus } from "@/features/working-tree";

import type { TaskTarget } from "./specs";

/**
 * Selects the working tree changes for the window's views (Changed files lists them, the graph
 * marks the row), and when the window was opened on a file, chooses it for the diff tab: its
 * unstaged changes, or its staged ones when it has only those.
 */
export async function chooseScopedFile({ path, summary, scope }: TaskTarget): Promise<void> {
  if (scope === null || scope.isFolder) {
    select(path, { kind: "worktree" });
    return;
  }
  const status = await fetchStatus(summary.id);
  const unstaged = status?.unstaged.some((file) => file.path === scope.relative) ?? false;
  const staged = status?.staged.some((file) => file.path === scope.relative) ?? false;
  select(path, { kind: staged && !unstaged ? "index" : "worktree" });
  selectFile(path, scope.relative);
}
