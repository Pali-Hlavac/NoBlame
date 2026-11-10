/** What the diff tab says about a submodule: its pointers, and what changed inside it. */
import { shortId } from "@/features/graph";
import type { SubmoduleChangesDto } from "@/shared/ipc/bindings";

import type { DiffFile } from "./diffFile";

/** How a submodule entry changed. */
export type PointerChange =
  | { kind: "added"; to: string }
  | { kind: "removed"; from: string }
  /** `to: null`: the commit checked out in the working tree. */
  | { kind: "changed"; from: string; to: string | null }
  /** Nothing to compare (a working tree entry not in the index). */
  | { kind: "none" };

export function pointerChange(file: DiffFile): PointerChange {
  if (file.worktree === true) {
    return file.oldId === null ? { kind: "none" } : { kind: "changed", from: file.oldId, to: null };
  }
  if (file.oldId === null) return file.newId ? { kind: "added", to: file.newId } : { kind: "none" };
  if (file.newId === null) return { kind: "removed", from: file.oldId };
  return { kind: "changed", from: file.oldId, to: file.newId };
}

/** One sentence on the pointers; `checkedOut` is what the working tree has, once known. */
export function pointerText(change: PointerChange, checkedOut: string | undefined): string {
  switch (change.kind) {
    case "added":
      return `Added at ${shortId(change.to)}.`;
    case "removed":
      return `Removed; it was at ${shortId(change.from)}.`;
    case "none":
      return "Its checked-out commit or its own files changed.";
    case "changed":
      if (change.to !== null) {
        return `Its commit changed from ${shortId(change.from)} to ${shortId(change.to)}.`;
      }
      return checkedOut === undefined || checkedOut === change.from
        ? `Checked out at the recorded commit, ${shortId(change.from)}.`
        : `Checked out at ${shortId(checkedOut)}; the repository records ${shortId(change.from)}.`;
  }
}

/** What else changed inside a submodule in the working tree, or null. */
export function insideText(changes: SubmoduleChangesDto | null | undefined): string | null {
  if (!changes) return null;
  const parts = [
    changes.modified && "changed files",
    changes.untracked && "untracked files",
  ].filter((part): part is string => typeof part === "string");
  return parts.length === 0 ? null : `It also has ${parts.join(" and ")} of its own.`;
}

/** Separators at the end of a path. */
const TRAILING_SEPARATORS = /[\\/]+$/;

/** The submodule's folder: `path` (`/` separators) inside `root`, with `root`'s separator. */
export function submoduleFolder(root: string, path: string): string {
  const separator = root.includes("\\") ? "\\" : "/";
  return `${root.replace(TRAILING_SEPARATORS, "")}${separator}${path.split("/").join(separator)}`;
}
