/**
 * The "artificial" rows shown above the commits: the working tree changes, then the staged
 * changes, each only when it has something to show (as Git Extensions does).
 */
import type { StatusSummaryDto } from "@/shared/ipc/bindings";

/** Which part of the working tree a row stands for. */
export type WorkingTreeKind = "worktree" | "index";

export interface WorkingTreeRow {
  kind: WorkingTreeKind;
  title: string;
  /** Counts in words, e.g. "3 changed, 1 untracked". */
  detail: string;
}

/** "1 file" / "2 files". */
function count(value: number, word: string): string {
  return `${value} ${word}`;
}

/** What the working tree row says: changed, untracked and conflicted counts. */
export function worktreeDetail(summary: StatusSummaryDto): string {
  return [
    summary.conflicted > 0 ? count(summary.conflicted, "conflicted") : null,
    summary.unstaged > 0 ? count(summary.unstaged, "changed") : null,
    summary.untracked > 0 ? count(summary.untracked, "untracked") : null,
  ]
    .filter((part) => part !== null)
    .join(", ");
}

/** The rows to show for `summary`, top to bottom; none when the working tree is clean. */
export function workingTreeRows(summary: StatusSummaryDto | null | undefined): WorkingTreeRow[] {
  if (!summary) return [];
  const rows: WorkingTreeRow[] = [];
  if (summary.unstaged + summary.untracked + summary.conflicted > 0) {
    rows.push({
      kind: "worktree",
      title: "Working tree changes",
      detail: worktreeDetail(summary),
    });
  }
  if (summary.staged > 0) {
    rows.push({
      kind: "index",
      title: "Staged changes",
      detail: count(summary.staged, summary.staged === 1 ? "file" : "files"),
    });
  }
  return rows;
}
