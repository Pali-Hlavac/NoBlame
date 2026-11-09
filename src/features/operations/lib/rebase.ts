/** Words for rebasing. */
import type { RebaseOutcomeDto } from "@/shared/ipc/bindings";

import { CONFLICT_ADVICE, type Outcome } from "./outcome";

/**
 * The toast after rebasing `target` onto `onto`; `published` says whether commits that were
 * pushed got new ids (the branch then needs a force push).
 */
export function rebaseToast(
  outcome: RebaseOutcomeDto,
  target: string,
  onto: string,
  published: boolean,
): Outcome {
  const push = published
    ? "Some of its commits were pushed before: push it with force (with lease) to update the remote."
    : undefined;
  switch (outcome) {
    case "upToDate":
      return { title: `${target} already contains ${onto}`, tone: "info" };
    case "rebased":
      return { title: `Rebased ${target} onto ${onto}`, description: push, tone: "success" };
    case "stashConflicts":
      return {
        title: `Rebased ${target}, but your stashed changes conflict`,
        description:
          "Resolve the conflict markers in your files. The changes are also kept in the stash list.",
        tone: "warning",
      };
    case "conflicts":
      return {
        title: "The rebase stopped: some files conflict",
        description: CONFLICT_ADVICE,
        tone: "warning",
      };
  }
}
