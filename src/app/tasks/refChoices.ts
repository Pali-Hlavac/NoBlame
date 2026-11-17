/**
 * What the Switch, Merge and Rebase windows offer to choose from: the local branches, remote
 * branches and tags, without the current branch, and what stands in the way.
 */
import type { OperationKindDto, RefEntry } from "@/shared/ipc/bindings";

/**
 * The references that can be switched to, merged or rebased onto: branches, remote branches
 * and tags, without the branch HEAD is on and the remotes' `HEAD` pointers.
 */
export function choosableRefs(refs: readonly RefEntry[]): RefEntry[] {
  return refs.filter(({ label }) => {
    if (label.kind === "branch") return !label.isHead;
    if (label.kind === "remote") return !label.name.endsWith("/HEAD");
    return label.kind === "tag";
  });
}

/**
 * The list value of the current branch's upstream (`refs/remotes/origin/main` is
 * `remote:origin/main`, a local upstream `refs/heads/dev` is `branch:dev`), if it has one.
 */
export function upstreamValue(upstream: string | undefined): string | undefined {
  if (upstream?.startsWith("refs/remotes/")) {
    return `remote:${upstream.slice("refs/remotes/".length)}`;
  }
  if (upstream?.startsWith("refs/heads/")) return `branch:${upstream.slice("refs/heads/".length)}`;
  return undefined;
}

const OPERATION_NAMES: Record<OperationKindDto, string | null> = {
  merge: "A merge",
  cherryPick: "A cherry-pick",
  revert: "A revert",
  rebase: "A rebase",
  applyMailbox: "Applying patches",
  // Bisecting checks commits out itself; switching and merging still work.
  bisect: null,
};

/** "A merge is in progress…" when an operation stands in the way, else `null`. */
export function operationInTheWay(kind: OperationKindDto | undefined): string | null {
  const name = kind ? OPERATION_NAMES[kind] : null;
  return name
    ? `${name} is in progress. Finish or abort it first, with the bar above the commits.`
    : null;
}
