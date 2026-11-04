/** Two revisions compared: the files that differ, and the commits each side lacks. */
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { graphKeys } from "@/features/graph";
import type { Comparison } from "@/features/selection";
import { statusKeys } from "@/features/working-tree";
import { commands, unwrap } from "@/shared/ipc/client";

import { compareRequest, isComplete, withWorkingTree } from "../lib/revisions";

/**
 * Under the graph's keys: a reload (a branch moved) compares again, and closing the repository
 * drops them. Revisions are keyed as typed, so `main` follows the branch. A comparison with the
 * working tree is under the status keys instead, read again whenever the files or refs change.
 */
export const compareKeys = {
  files: (repoId: number, comparison: Comparison) => {
    const { base, target, sinceMergeBase } = compareRequest(comparison);
    return withWorkingTree(comparison)
      ? ([...statusKeys.all(repoId), "compare", base, sinceMergeBase] as const)
      : ([...graphKeys.all(repoId), "compare", base, target, sinceMergeBase] as const);
  },
  counts: (repoId: number, base: string, target: string) =>
    [...graphKeys.all(repoId), "ahead-behind", base, target] as const,
};

/** The files that differ, with the commits both sides name; idle until both are chosen. */
export function useComparisonFiles(repoId: number, comparison: Comparison) {
  return useQuery({
    queryKey: compareKeys.files(repoId, comparison),
    queryFn: () => unwrap(commands.getComparison(repoId, compareRequest(comparison))),
    staleTime: Infinity,
    enabled: isComplete(comparison),
    // The last comparison stays (under an overlay) while the next one is read.
    placeholderData: keepPreviousData,
  });
}

/** Commits the target has that the base lacks and back (commit ids; idle without them). */
export function useAheadBehind(repoId: number, base?: string, target?: string) {
  return useQuery({
    queryKey: compareKeys.counts(repoId, base ?? "", target ?? ""),
    queryFn: () => unwrap(commands.countAheadBehind(repoId, base ?? "", target ?? "")),
    staleTime: Infinity,
    enabled: base !== undefined && target !== undefined,
  });
}
