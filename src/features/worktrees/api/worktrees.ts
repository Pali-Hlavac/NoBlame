/**
 * The repository's worktrees, and adding, removing, locking, unlocking and pruning them. The
 * list is keyed under the repository's references, so the file watcher's ref changes (a branch
 * moved in another worktree) read it again; every change here reads it again at once.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { refKeys } from "@/features/graph";
import type { AddWorktreeRequestDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

export const worktreeKeys = {
  list: (repoId: number) => [...refKeys.all(repoId), "worktrees"] as const,
};

export function useWorktrees(repoId: number) {
  return useQuery({
    queryKey: worktreeKeys.list(repoId),
    queryFn: () => unwrap(commands.listWorktrees(repoId)),
  });
}

/** A change to the worktrees; the list (and the refs: a new branch) is read again after it. */
function useWorktreeChange<T>(repoId: number, run: (request: T) => Promise<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => queryClient.invalidateQueries({ queryKey: refKeys.all(repoId) }),
  });
}

export function useAddWorktree(repoId: number) {
  return useWorktreeChange(repoId, (request: AddWorktreeRequestDto) =>
    unwrap(commands.addWorktree(repoId, request)),
  );
}

export function useRemoveWorktree(repoId: number) {
  return useWorktreeChange(repoId, ({ folder, force }: { folder: string; force: boolean }) =>
    unwrap(commands.removeWorktree(repoId, folder, force)),
  );
}

export function useLockWorktree(repoId: number) {
  return useWorktreeChange(repoId, ({ folder, reason }: { folder: string; reason: string }) =>
    unwrap(commands.lockWorktree(repoId, folder, reason)),
  );
}

export function useUnlockWorktree(repoId: number) {
  return useWorktreeChange(repoId, (folder: string) =>
    unwrap(commands.unlockWorktree(repoId, folder)),
  );
}

export function usePruneWorktrees(repoId: number) {
  return useWorktreeChange(repoId, () => unwrap(commands.pruneWorktrees(repoId)));
}

/** The uncommitted files of the worktree at `folder` (counted when removing it). */
export function useWorktreeChanges(folder: string | null) {
  return useQuery({
    queryKey: ["worktree-changes", folder],
    queryFn: () => unwrap(commands.getChangeCounts(folder ?? "")),
    enabled: folder !== null,
    staleTime: 0,
    gcTime: 0,
  });
}
