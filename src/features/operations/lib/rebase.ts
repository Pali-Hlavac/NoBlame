/** Words for rebasing. */
import type { InteractiveResultDto, RebaseOutcomeDto } from "@/shared/ipc/bindings";

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

/** The toast after an interactive rebase of `target`. */
export function interactiveToast(
  result: InteractiveResultDto,
  target: string,
  published: boolean,
): Outcome {
  switch (result.outcome) {
    case "rebased":
      return {
        title: `Rewrote the commits of ${target}`,
        description: published
          ? "Some of them were pushed before: push with force (with lease) to update the remote."
          : undefined,
        tone: "success",
      };
    case "stopped":
      return result.detail?.includes("failed")
        ? {
            title: "The rebase stopped: a step failed",
            description: `${result.detail} Fix it, then choose Continue in the bar above the commits (or Abort).`,
            tone: "warning",
          }
        : {
            title: "The rebase stopped at the commit to edit",
            description:
              "Change it (amend it in the Commit module), then choose Continue in the bar above the commits.",
            tone: "info",
          };
    case "stashConflicts":
      return rebaseToast("stashConflicts", target, "", false);
    case "conflicts":
      return rebaseToast("conflicts", target, "", false);
  }
}
