/** Words for cherry-picking, reverting and resetting. */
import type { PickResultDto, ResetModeDto } from "@/shared/ipc/bindings";

import { CONFLICT_ADVICE, type Outcome } from "./outcome";

export type PickKind = "cherryPick" | "revert";

/** The toast after cherry-picking or reverting `commit` (its label) on `target`. */
export function pickToast(
  kind: PickKind,
  result: PickResultDto,
  commit: string,
  target: string,
): Outcome {
  const summary = result.summary ?? undefined;
  const cherry = kind === "cherryPick";
  switch (result.outcome) {
    case "committed":
      return {
        title: cherry ? `Cherry-picked ${commit} onto ${target}` : `Reverted ${commit}`,
        description: summary,
        tone: "success",
      };
    case "staged":
      return {
        title: cherry ? `Staged the changes of ${commit}` : `Staged the revert of ${commit}`,
        description: cherry
          ? "Review them and commit them in the Commit module."
          : "Review it and commit it in the Commit module, or choose Continue in the bar above the commits.",
        tone: "success",
      };
    case "empty":
      return {
        title: cherry
          ? `Nothing to cherry-pick: ${target} already has these changes`
          : `Nothing to revert: ${target} no longer has these changes`,
        tone: "info",
      };
    case "conflicts":
      return {
        title: `The ${cherry ? "cherry-pick" : "revert"} stopped: some files conflict`,
        description: CONFLICT_ADVICE,
        tone: "warning",
      };
  }
}

/** The reset choices, in the order the dialog lists them. */
export const RESET_MODES: readonly { mode: ResetModeDto; label: string; detail: string }[] = [
  {
    mode: "soft",
    label: "Soft",
    detail: "Moves only the branch. The changes of the commits it leaves stay staged (--soft).",
  },
  {
    mode: "mixed",
    label: "Mixed",
    detail: "Moves the branch and unstages. Every change stays in your files (git's default).",
  },
  {
    mode: "keep",
    label: "Keep my changes",
    detail:
      "Your files match the commit, but uncommitted changes stay; git refuses if they are in the way (--keep).",
  },
  {
    mode: "hard",
    label: "Hard",
    detail:
      "Your files match the commit. Uncommitted changes to tracked files are lost; untracked files stay (--hard).",
  },
];

/** "1 file" or "3 files". */
export function files(count: number): string {
  return count === 1 ? "1 file" : `${String(count)} files`;
}

/** "1 commit" or "3 commits". */
export function commits(count: number): string {
  return count === 1 ? "1 commit" : `${String(count)} commits`;
}
