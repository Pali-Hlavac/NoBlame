/**
 * What discarding files throws away, said before it happens: changed files go back to their
 * staged version, new files are deleted. Conflicted files and submodules are left alone (they
 * are resolved, or changed inside the submodule).
 */
import type { DiscardedFiles } from "@/features/working-tree";
import type { WorkingFileDto } from "@/shared/ipc/bindings";

/** Files named in a confirmation before "and N more". */
const NAMED_FILES = 5;

export interface DiscardPlan {
  title: string;
  description: string;
  files: DiscardedFiles;
}

const NO_UNDO = "NoBlame keeps no copy, so this cannot be undone.";

/** Can this file's working tree changes be thrown away from the list? */
export function canDiscard(file: WorkingFileDto): boolean {
  return file.status !== "conflicted" && !file.submodule;
}

function count(value: number, one: string, many: string): string {
  return `${value.toLocaleString()} ${value === 1 ? one : many}`;
}

function named(paths: readonly string[]): string {
  const shown = paths.slice(0, NAMED_FILES).join(", ");
  const more = paths.length - NAMED_FILES;
  return more > 0 ? `${shown} and ${more.toLocaleString()} more` : shown;
}

/** The plan for `files` (chosen, or all listed); `null` when none of them can be discarded. */
export function discardPlan(
  files: readonly WorkingFileDto[],
  { all, truncated }: { all: boolean; truncated: boolean },
): DiscardPlan | null {
  const kept = files.filter(canDiscard);
  const tracked = kept.filter((file) => file.status !== "untracked").map((file) => file.path);
  const untracked = kept.filter((file) => file.status === "untracked").map((file) => file.path);
  if (kept.length === 0) return null;
  const plan = { files: { tracked, untracked } };
  if (!all && kept.length === 1 && untracked.length === 1) {
    return {
      ...plan,
      title: `Delete ${untracked[0] ?? ""}?`,
      description: `It is a new file Git does not track, so it is deleted for good (not moved to the recycle bin). ${NO_UNDO}`,
    };
  }
  if (!all && kept.length === 1) {
    return {
      ...plan,
      title: `Discard the changes to ${tracked[0] ?? ""}?`,
      description: `It goes back to its staged version (or the last commit's when nothing is staged). ${NO_UNDO}`,
    };
  }
  const parts = [
    tracked.length > 0 &&
      `${count(tracked.length, "changed file goes", "changed files go")} back to the staged version (${named(tracked)})`,
    untracked.length > 0 &&
      `${count(untracked.length, "new file is", "new files are")} deleted (${named(untracked)})`,
  ].filter(Boolean);
  const skipped = files.length - kept.length;
  const notes = [
    skipped > 0 &&
      `${count(skipped, "conflicted file or submodule is left as it is", "conflicted files or submodules are left as they are")}.`,
    truncated && "Only the files listed are discarded.",
  ].filter(Boolean);
  return {
    ...plan,
    title: all
      ? "Discard all changes in the working tree?"
      : `Discard the changes to ${count(kept.length, "file", "files")}?`,
    description: [`${parts.join("; ")}.`, ...notes, NO_UNDO].join(" "),
  };
}
