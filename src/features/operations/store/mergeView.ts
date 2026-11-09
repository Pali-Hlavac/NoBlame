/**
 * The built-in merge view: which conflicted file it shows for each repository, and what was
 * decided for each of its conflicts (UI state until the file is saved). Keyed by repository id
 * and path, so switching files and back keeps the decisions.
 */
import { create } from "zustand";

import { showMergeTab } from "@/features/workspace";

/** How a conflict was decided. */
export type DecisionHow = "ours" | "theirs" | "oursThenTheirs" | "theirsThenOurs" | "edited";

/** What a conflict becomes in the merged file. */
export interface Decision {
  how: DecisionHow;
  text: string;
}

/** Decisions by the index of the conflict's chunk. */
export type Decisions = Readonly<Record<number, Decision | undefined>>;

interface MergeViewState {
  shown: Record<number, string | undefined>;
  decisions: Record<string, Decisions | undefined>;
}

const NO_DECISIONS: Decisions = {};

export const useMergeViewStore = create<MergeViewState>()(() => ({ shown: {}, decisions: {} }));

function fileKey(repoId: number, path: string): string {
  return `${String(repoId)}\n${path}`;
}

/** Shows the conflicted `path` in the merge tab (keeping what was decided for it before). */
export function showMergeView(repoId: number, path: string): void {
  useMergeViewStore.setState((state) => ({ shown: { ...state.shown, [repoId]: path } }));
  showMergeTab();
}

/** The file the merge tab shows for `repoId`. */
export function useShownMergeFile(repoId: number): string | undefined {
  return useMergeViewStore((state) => state.shown[repoId]);
}

/** What was decided for the conflicts of `path`. */
export function useDecisions(repoId: number, path: string): Decisions {
  return useMergeViewStore((state) => state.decisions[fileKey(repoId, path)] ?? NO_DECISIONS);
}

/** Decides conflicts (by chunk index); `undefined` undoes a decision. */
export function decide(
  repoId: number,
  path: string,
  changes: Readonly<Record<number, Decision | undefined>>,
): void {
  const key = fileKey(repoId, path);
  useMergeViewStore.setState((state) => ({
    decisions: { ...state.decisions, [key]: { ...state.decisions[key], ...changes } },
  }));
}

/** Forgets every decision for `path` (start over, or saved). */
export function forgetDecisions(repoId: number, path: string): void {
  const key = fileKey(repoId, path);
  useMergeViewStore.setState((state) => ({ decisions: { ...state.decisions, [key]: undefined } }));
}
