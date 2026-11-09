/**
 * Rebasing the current branch, and what a rebase would replay. The status is read again at
 * once, so the bar above the commits follows a rebase that stopped on conflicts.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { statusKeys } from "@/features/working-tree";
import type { RebaseRequestDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

/** Rebases the current branch. The dialog shows errors. */
export function useRebase(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: RebaseRequestDto) => unwrap(commands.rebaseCurrent(repoId, request)),
    meta: { silent: true, activity: "Rebasing" },
    onSettled: () => queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) }),
  });
}

/** The commits a rebase onto `onto` replays, and how many of them were pushed. */
export function useRebasePreview(repoId: number, onto: string) {
  return useQuery({
    queryKey: ["operations", repoId, "rebase-preview", onto],
    queryFn: () => unwrap(commands.getRebasePreview(repoId, onto)),
    // Always read again: the branch may have moved since the dialog last opened.
    gcTime: 0,
  });
}
