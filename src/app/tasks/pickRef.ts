/** What choosing a branch does in a Switch, Merge or Rebase window. */
import { refRevision, type RefActions } from "@/features/graph";
import type { RefEntry } from "@/shared/ipc/bindings";

import type { RefPickTask } from "./refPick";

/** A reference from the list, or a revision typed in (a commit id, `HEAD~2`). */
export type PickedRef = { kind: "ref"; entry: RefEntry } | { kind: "typed"; revision: string };

/**
 * Hands the choice to the action the graph's menu uses: a local branch is checked out at once;
 * a remote branch asks for its local branch, a tag or a commit explains the detached HEAD;
 * merging and rebasing ask how in their own dialog.
 */
export function pickRef(task: RefPickTask, actions: RefActions, picked: PickedRef): void {
  const point =
    picked.kind === "typed"
      ? { revision: picked.revision, label: picked.revision }
      : { revision: refRevision(picked.entry.label), label: picked.entry.label.name };
  if (task === "merge") actions.merge(point);
  else if (task === "rebase") actions.rebase(point);
  else if (picked.kind === "ref" && picked.entry.label.kind === "branch") {
    actions.checkoutBranch(picked.entry.label.name);
  } else if (picked.kind === "ref" && picked.entry.label.kind === "remote") {
    const { name } = picked.entry.label;
    actions.checkoutRemote({ namespace: "remote", name, target: picked.entry.target });
  } else actions.checkoutCommit(point);
}
