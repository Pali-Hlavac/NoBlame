/** Words for bisecting: the toast after a mark, and the bar's line. */
import { shortId } from "@/features/graph";
import type { BisectMarkDto, BisectOutcomeDto, BisectStateDto } from "@/shared/ipc/bindings";

import type { BisectCounts } from "../store/bisect";
import type { Outcome } from "./outcome";

/** "good", "bad", "skipped", as a commit is marked. */
export const MARK_WORDS: Readonly<Record<BisectMarkDto, string>> = {
  good: "good",
  bad: "bad",
  skip: "skipped",
};

function commits(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "commit" : "commits"}`;
}

/** The toast after marking a commit. */
export function bisectToast(mark: BisectMarkDto, outcome: BisectOutcomeDto): Outcome {
  const marked = `Marked as ${MARK_WORDS[mark]}`;
  switch (outcome.kind) {
    case "waiting":
      return {
        title: marked,
        description:
          mark === "bad"
            ? "Now mark a good commit, one without the problem: right-click it in the graph."
            : "Now mark a bad commit, one with the problem: right-click it in the graph.",
        tone: "info",
      };
    case "testing":
      return {
        title: `${marked}: the next commit to test is checked out`,
        description: `${commits(outcome.remaining)} left after it (about ${outcome.steps.toLocaleString()} more ${outcome.steps === 1 ? "step" : "steps"}). Test it, then choose Good, Bad or Skip in the bar.`,
        tone: "info",
      };
    case "found":
      return {
        title: `Found the first bad commit: ${shortId(outcome.commit)}`,
        description: "Choose Stop bisecting in the bar to go back to where you were.",
        tone: "success",
      };
    case "onlySkipped":
      return {
        title: "Only skipped commits are left",
        description:
          "The first bad commit is one of them; Git's words are in the log. Stop bisecting, or mark one of them.",
        tone: "warning",
      };
  }
}

/** What the bar says while bisecting; `counts` from the last mark, when it checked out this one. */
export function bisectLine(state: BisectStateDto, counts?: BisectCounts): string {
  if (state.firstBad) {
    return `Found the first bad commit: ${shortId(state.firstBad.id)} ${state.firstBad.summary}`;
  }
  if (!state.bad && state.good.length === 0) {
    return "Bisecting: mark a bad commit (with the problem) and a good one (without), right-clicking them in the graph";
  }
  if (!state.bad) return "Bisecting: now mark a bad commit (with the problem) in the graph";
  if (state.good.length === 0) {
    return "Bisecting: now mark a good commit (without the problem) in the graph";
  }
  const testing = state.testing
    ? `Testing ${shortId(state.testing.id)} ${state.testing.summary}`
    : "Bisecting";
  const known = state.testing && counts?.commit === state.testing.id ? counts : null;
  const left = known
    ? `: ${commits(known.remaining)} left after it (about ${known.steps.toLocaleString()} more ${known.steps === 1 ? "step" : "steps"})`
    : "";
  return `${testing}${left}`;
}

/** The marks so far: "1 bad, 2 good, 1 skipped". */
export function marksLine(state: BisectStateDto): string {
  const parts = [
    state.bad ? "1 bad" : null,
    state.good.length > 0 ? `${state.good.length.toLocaleString()} good` : null,
    state.skipped.length > 0 ? `${state.skipped.length.toLocaleString()} skipped` : null,
  ].filter((part): part is string => part !== null);
  return parts.join(", ");
}

/** Whether marking the checked-out commit makes sense (both ends known, nothing found yet). */
export function canMarkHead(state: BisectStateDto): boolean {
  return state.bad !== null && state.good.length > 0 && state.firstBad === null;
}
