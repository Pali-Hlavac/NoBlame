/** The stash list of an open repository, a stash's files, and making, applying and dropping. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { graphKeys } from "@/features/graph";
import { statusKeys } from "@/features/working-tree";
import type {
  ApplyStashFilesRequestDto,
  ApplyStashRequestDto,
  StashRequestDto,
  StashTargetDto,
} from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

/** Under the graph's keys, so they are dropped when the repository closes. */
export const stashKeys = {
  all: (repoId: number) => [...graphKeys.all(repoId), "stashes"] as const,
  files: (repoId: number, stashId: string) =>
    [...graphKeys.all(repoId), "stashes", "files", stashId] as const,
};

/** Stashes change outside the app (a terminal), so the list refreshes when the window regains focus. */
export function useStashes(repoId: number) {
  return useQuery({
    queryKey: stashKeys.all(repoId),
    queryFn: () => unwrap(commands.listStashes(repoId)),
    refetchOnWindowFocus: true,
  });
}

/** The files of the stash `stashId` (a stash never changes, so they are read once). */
export function useStashFiles(repoId: number, stashId: string | undefined) {
  return useQuery({
    queryKey: stashKeys.files(repoId, stashId ?? ""),
    queryFn: () => unwrap(commands.getStashFiles(repoId, stashId ?? "")),
    staleTime: Infinity,
    enabled: stashId !== undefined,
  });
}

/**
 * After any stash change: the list and the working tree status are read again at once (the file
 * watcher reports both a moment later, and moves the graph).
 */
function useRefresh(repoId: number) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: stashKeys.all(repoId) }),
      queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) }),
    ]);
}

/** Stashes the working tree's changes (or some files). Errors show in the dialog. */
export function useStashChanges(repoId: number) {
  const refresh = useRefresh(repoId);
  return useMutation({
    mutationFn: (request: StashRequestDto) => unwrap(commands.stashChanges(repoId, request)),
    meta: { silent: true },
    onSettled: refresh,
  });
}

/** Applies or pops a whole stash. */
export function useApplyStash(repoId: number) {
  const refresh = useRefresh(repoId);
  return useMutation({
    mutationFn: (request: ApplyStashRequestDto) => unwrap(commands.applyStash(repoId, request)),
    onSettled: refresh,
  });
}

/** Applies some files of a stash; the stash is kept. */
export function useApplyStashFiles(repoId: number) {
  const refresh = useRefresh(repoId);
  return useMutation({
    mutationFn: (request: ApplyStashFilesRequestDto) =>
      unwrap(commands.applyStashFiles(repoId, request)),
    onSettled: refresh,
  });
}

/** Drops a stash. Errors show in the confirmation. */
export function useDropStash(repoId: number) {
  const refresh = useRefresh(repoId);
  return useMutation({
    mutationFn: (stash: StashTargetDto) => unwrap(commands.dropStash(repoId, stash)),
    meta: { silent: true },
    onSettled: refresh,
  });
}
