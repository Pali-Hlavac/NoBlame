/**
 * How many commits were left after the last mark, per repository: git prints it with each mark,
 * and counting again on every refresh can take a minute in a huge history. Shown only while the
 * commit that mark checked out is still the one tested.
 */
import { create } from "zustand";

import type { BisectOutcomeDto } from "@/shared/ipc/bindings";

export interface BisectCounts {
  /** The commit the mark checked out. */
  commit: string;
  remaining: number;
  steps: number;
}

interface BisectCountsState {
  counts: Readonly<Record<number, BisectCounts>>;
}

export const useBisectCounts = create<BisectCountsState>(() => ({ counts: {} }));

/** Keeps the counts of a mark's outcome (when it checked out a commit to test). */
export function rememberCounts(repoId: number, outcome: BisectOutcomeDto): void {
  if (outcome.kind !== "testing" || outcome.commit === "") return;
  const { commit, remaining, steps } = outcome;
  useBisectCounts.setState((state) => ({
    counts: { ...state.counts, [repoId]: { commit, remaining, steps } },
  }));
}
