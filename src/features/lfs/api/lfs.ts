/**
 * Git LFS: the repository's LFS files (keyed under the status, so the watcher's changes read them
 * again), the locks on the LFS server (read when asked: it is a network call), locking and
 * unlocking, and downloading contents as a job.
 */
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { afterJob, startJob } from "@/features/jobs";
import { statusKeys } from "@/features/working-tree";
import { commands, unwrap } from "@/shared/ipc/client";

export const lfsKeys = {
  state: (repoId: number) => [...statusKeys.all(repoId), "lfs"] as const,
  locks: (repoId: number) => ["lfs-locks", repoId] as const,
};

/** Whether git-lfs is installed, and the LFS files with or without their content. */
export function useLfs(repoId: number) {
  return useQuery({
    queryKey: lfsKeys.state(repoId),
    queryFn: () => unwrap(commands.getLfs(repoId)),
  });
}

/** The locks on the LFS server; read only once asked (`enabled`). */
export function useLfsLocks(repoId: number, enabled: boolean) {
  return useQuery({
    queryKey: lfsKeys.locks(repoId),
    queryFn: () => unwrap(commands.listLfsLocks(repoId)),
    enabled,
    retry: false,
  });
}

/** Locks a file; the locks are read again. Callers show errors. */
export function useLockLfsFile(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => unwrap(commands.lockLfsFile(repoId, path)),
    meta: { silent: true, activity: "Locking" },
    onSettled: () => queryClient.invalidateQueries({ queryKey: lfsKeys.locks(repoId) }),
  });
}

/** Unlocks a lock (`force`: someone else's); the locks are read again. */
export function useUnlockLfsFile(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force: boolean }) =>
      unwrap(commands.unlockLfsFile(repoId, id, force)),
    meta: { silent: true, activity: "Unlocking" },
    onSettled: () => queryClient.invalidateQueries({ queryKey: lfsKeys.locks(repoId) }),
  });
}

/** Starts `git lfs pull`; the toast follows it, and the files are read again when it ends. */
export function startLfsPull(queryClient: QueryClient, repoId: number, path: string): void {
  const started = unwrap(commands.pullLfs(path));
  startJob(started, "lfsPull");
  started.then(
    (id) => {
      afterJob(id, () => void queryClient.invalidateQueries({ queryKey: lfsKeys.state(repoId) }));
    },
    // `startJob` says why it did not start.
    () => undefined,
  );
}
