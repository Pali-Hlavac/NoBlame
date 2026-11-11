/** Words and folders for the Worktrees module. */
import { shortId } from "@/features/graph";
import type { ChangeCountsDto, WorktreeDto } from "@/shared/ipc/bindings";
import { folderName, joinPath, parentOf } from "@/shared/lib/paths";

export { folderName };

/** What it has checked out, in words: the branch, the commit, or why neither. */
export function checkedOut(worktree: WorktreeDto): string {
  if (worktree.bare) return "bare repository";
  if (worktree.branch !== null) return worktree.branch;
  if (worktree.head !== null) return `detached at ${shortId(worktree.head)}`;
  return "no commit yet";
}

/** A folder for a new worktree: next to the main one, named after it and the branch. */
export function suggestedFolder(mainPath: string, name: string): string {
  const safe = name.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "");
  return joinPath(parentOf(mainPath), `${folderName(mainPath)}-${safe || "worktree"}`);
}

/** Why `folder` cannot be a new worktree's folder before git is asked, or null. */
export function folderProblem(folder: string): string | null {
  const trimmed = folder.trim();
  if (trimmed === "") return "Enter a folder.";
  const absolute =
    /^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("\\\\");
  return absolute ? null : "Enter a full path (C:\\… or /…).";
}

/** "2 new and 1 changed file", or null when there are none. */
export function changesText(counts: ChangeCountsDto | null | undefined): string | null {
  if (!counts) return null;
  const parts = [
    counts.added > 0 && `${counts.added.toLocaleString()} new`,
    counts.changed > 0 && `${counts.changed.toLocaleString()} changed`,
    counts.deleted > 0 && `${counts.deleted.toLocaleString()} deleted`,
  ].filter((part): part is string => typeof part === "string");
  if (parts.length === 0) return null;
  const total = counts.added + counts.changed + counts.deleted;
  const last = parts.pop() ?? "";
  const listed = parts.length > 0 ? `${parts.join(", ")} and ${last}` : last;
  return `${listed} ${total === 1 ? "file" : "files"}`;
}

/** It has files checked out that a tab can show (not bare, its folder still there). */
export function canOpen(worktree: WorktreeDto): boolean {
  return !worktree.bare && worktree.prunable === null;
}
