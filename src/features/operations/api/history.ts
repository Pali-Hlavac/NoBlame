/**
 * Cherry-picking, reverting and resetting the current branch, and what a reset takes off it.
 * The file watcher reports what changed; the status is read again at once so the bar above the
 * commits and the counts follow without waiting for it.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { statusKeys } from "@/features/working-tree";
import type { PickRequestDto, ResetRequestDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

const PICK_ACTIVITY = { cherryPick: "Cherry-picking", revert: "Reverting" } as const;

/** Cherry-picks or reverts a commit. The dialog shows errors. */
export function usePick(repoId: number, kind: PickRequestDto["kind"]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: PickRequestDto) => unwrap(commands.pickCommit(repoId, request)),
    meta: { silent: true, activity: PICK_ACTIVITY[kind] },
    onSettled: () => queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) }),
  });
}

/** Resets the current branch to a commit. The dialog shows errors. */
export function useReset(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ResetRequestDto) => unwrap(commands.resetCurrent(repoId, request)),
    meta: { silent: true, activity: "Resetting the branch" },
    onSettled: () => queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) }),
  });
}

/** The commits HEAD has and `commit` lacks: what a reset to `commit` takes off the branch. */
export function useCommitsLeaving(repoId: number, commit: string) {
  return useQuery({
    queryKey: ["operations", repoId, "leaving", commit],
    queryFn: () => unwrap(commands.getMissingCommits(repoId, "HEAD", commit)),
    // Always read again: the branch may have moved since the dialog last opened.
    gcTime: 0,
  });
}
