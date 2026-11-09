/** Words for merges and for the operation in progress. */
import type {
  MergeModeDto,
  MergeResultDto,
  OperationDto,
  OperationKindDto,
} from "@/shared/ipc/bindings";

import { CONFLICT_ADVICE, type Outcome } from "./outcome";

/** The merge choices, in the order the dialog lists them. */
export const MERGE_MODES: readonly { mode: MergeModeDto; label: string; detail: string }[] = [
  {
    mode: "default",
    label: "Fast-forward when possible",
    detail: "A merge commit only when both branches have new commits (git's default).",
  },
  {
    mode: "noFastForward",
    label: "Always create a merge commit",
    detail: "Keeps a record that the branch was merged (--no-ff).",
  },
  {
    mode: "fastForwardOnly",
    label: "Fast-forward only",
    detail: "Refuses when both branches have new commits (--ff-only).",
  },
  {
    mode: "squash",
    label: "Squash",
    detail: "Stages all its changes as one; you commit them yourself (--squash).",
  },
];

/** The toast after a merge of `source` into `target`: its title, description and tone. */
export function mergeToast(result: MergeResultDto, source: string, target: string): Outcome {
  const summary = result.summary ?? undefined;
  switch (result.outcome) {
    case "upToDate":
      return { title: `${target} already contains ${source}`, tone: "info" };
    case "fastForwarded":
      return {
        title: `Fast-forwarded ${target} to ${source}`,
        description: summary,
        tone: "success",
      };
    case "merged":
      return { title: `Merged ${source} into ${target}`, description: summary, tone: "success" };
    case "squashed":
      return {
        title: `Staged the changes of ${source}`,
        description: "Commit them in the Commit module to finish the squash.",
        tone: "success",
      };
    case "conflicts":
      return {
        title: "The merge stopped: some files conflict",
        description: CONFLICT_ADVICE,
        tone: "warning",
      };
  }
}

const KIND_WORDS: Readonly<Record<OperationKindDto, string>> = {
  merge: "Merging",
  cherryPick: "Cherry-picking",
  revert: "Reverting",
  rebase: "Rebasing",
  applyMailbox: "Applying patches",
  bisect: "Bisecting",
};

/** `Merging: Merge branch 'topic'`, `Rebasing feature (step 3 of 7)`. */
export function operationTitle(operation: OperationDto): string {
  const words = KIND_WORDS[operation.kind];
  const step =
    operation.step !== null && operation.steps !== null
      ? ` (step ${String(operation.step)} of ${String(operation.steps)})`
      : "";
  if (!operation.detail) return `${words}${step}`;
  return operation.kind === "rebase"
    ? `${words} ${operation.detail}${step}`
    : `${words}: ${operation.detail}${step}`;
}

/** What Continue did, for its toast (a rebase may stop again at a later commit). */
export const CONTINUED_WORDS: Readonly<Record<OperationKindDto, string>> = {
  merge: "Merge finished",
  cherryPick: "Cherry-pick continued",
  revert: "Revert continued",
  rebase: "Rebase continued",
  applyMailbox: "Applying patches continued",
  bisect: "Bisecting continued",
};

/** Whether the operation can leave out the commit it stopped at. */
export function canSkip(kind: OperationKindDto): boolean {
  return kind === "cherryPick" || kind === "revert" || kind === "rebase" || kind === "applyMailbox";
}

/** What Abort puts back, for its confirmation. */
export const ABORT_WORDS: Readonly<Record<OperationKindDto, string>> = {
  merge: "The branch and the files go back to how they were before the merge.",
  cherryPick: "The branch and the files go back to how they were before the cherry-pick.",
  revert: "The branch and the files go back to how they were before the revert.",
  rebase:
    "The branch goes back to where it was before the rebase; commits already rebased are dropped from it.",
  applyMailbox: "The branch goes back to where it was before applying the patches.",
  bisect: "Bisecting ends and HEAD goes back to where it was before.",
};
