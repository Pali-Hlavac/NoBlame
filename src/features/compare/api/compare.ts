/** Two revisions compared: the files that differ, and the commits each side lacks. */
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { graphKeys } from "@/features/graph";
import type { Comparison } from "@/features/selection";
import { commands, unwrap } from "@/shared/ipc/client";

import { isComplete } from "../lib/revisions";

/**
 * Under the graph's keys: a reload (a branch moved) compares again, and closing the repository
 * drops them. Revisions are keyed as typed, so `main` follows the branch.
 */
export const compareKeys = {
  files: (repoId: number, { base, target, sinceMergeBase }: Comparison) =>
    [...graphKeys.all(repoId), "compare", base.trim(), target.trim(), sinceMergeBase] as const,
  counts: (repoId: number, base: string, target: string) =>
    [...graphKeys.all(repoId), "ahead-behind", base, target] as const,
};

/** The files that differ, with the commits both sides name; idle until both are chosen. */
export function useComparisonFiles(repoId: number, comparison: Comparison) {
  return useQuery({
    queryKey: compareKeys.files(repoId, comparison),
    queryFn: () =>
      unwrap(
        commands.getComparison(repoId, {
          base: comparison.base.trim(),
          target: comparison.target.trim(),
          sinceMergeBase: comparison.sinceMergeBase,
        }),
      ),
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
