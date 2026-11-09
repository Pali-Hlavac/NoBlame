/** Words for conflicts: how a file conflicts, and who "ours" and "theirs" are. */
import type { ConflictKindDto, OperationDto } from "@/shared/ipc/bindings";

/** How the file conflicts, in a few words. */
export const KIND_WORDS: Readonly<Record<ConflictKindDto, string>> = {
  bothModified: "changed on both sides",
  bothAdded: "added on both sides",
  deletedByUs: "deleted by ours, changed by theirs",
  deletedByThem: "changed by ours, deleted by theirs",
  addedByUs: "only ours has it",
  addedByThem: "only theirs has it",
  bothDeleted: "deleted on both sides",
};

/** Whether "ours" has the file (else taking ours deletes it). */
export function hasOurs(kind: ConflictKindDto): boolean {
  return (
    kind === "bothModified" ||
    kind === "bothAdded" ||
    kind === "deletedByThem" ||
    kind === "addedByUs"
  );
}

/** Whether "theirs" has the file (else taking theirs deletes it). */
export function hasTheirs(kind: ConflictKindDto): boolean {
  return (
    kind === "bothModified" ||
    kind === "bothAdded" ||
    kind === "deletedByUs" ||
    kind === "addedByThem"
  );
}

/** Whether a merge tool can show it: both sides have a version. */
export function canMergeInTool(kind: ConflictKindDto): boolean {
  return kind === "bothModified" || kind === "bothAdded";
}

/** Who "ours" and "theirs" are during `operation`, on branch `head` (git's naming). */
export function sideNames(
  operation: OperationDto | null | undefined,
  head: string,
): { ours: string; theirs: string } {
  const detail = operation?.detail ?? "";
  switch (operation?.kind) {
    case "rebase":
      // A rebase replays your commits on the new base: the roles swap.
      return { ours: "the branch you rebase onto", theirs: "your commit being replayed" };
    case "cherryPick":
      return { ours: head, theirs: `the picked commit ${detail}`.trim() };
    case "revert":
      return { ours: head, theirs: `the revert of ${detail}`.trim() };
    case "applyMailbox":
      return { ours: head, theirs: "the patch" };
    default: {
      const merged = /branch '([^']+)'/.exec(detail)?.[1];
      return { ours: head, theirs: merged ?? "the merged branch" };
    }
  }
}
