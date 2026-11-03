/** Staging, unstaging and committing in an open repository, and the last commit's message. */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { statusKeys } from "@/features/working-tree";
import type { CommitRequestDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

export const commitKeys = {
  headMessage: (repoId: number) => ["commit", repoId, "head-message"] as const,
};

/** A change to the index: these paths (both names of a rename), or everything. */
export interface IndexChange {
  stage: boolean;
  /** `undefined`: everything. */
  paths?: readonly string[];
}

function runIndexChange(repoId: number, { stage, paths }: IndexChange): Promise<null> {
  if (paths === undefined) {
    return unwrap(stage ? commands.stageAllFiles(repoId) : commands.unstageAllFiles(repoId));
  }
  const list = [...paths];
  return unwrap(stage ? commands.stageFiles(repoId, list) : commands.unstageFiles(repoId, list));
}

/**
 * Stages or unstages files. The status is read again at once; the file watcher would report
 * the change too, a moment later.
 */
export function useIndexChange(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (change: IndexChange) => runIndexChange(repoId, change),
    onSettled: () => queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) }),
  });
}

/**
 * Commits the staged changes. Errors are shown in the panel (they carry the hooks' output), not
 * as a toast. The graph follows through the file watcher, which reports the new commit.
 */
export function useCreateCommit(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CommitRequestDto) => unwrap(commands.createCommit(repoId, request)),
    meta: { silent: true },
    onSettled: async () => {
      queryClient.removeQueries({ queryKey: commitKeys.headMessage(repoId) });
      await queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) });
    },
  });
}

/** The message of the commit HEAD points at (`null` before the first commit), read fresh. */
export function useFetchHeadMessage(repoId: number): () => Promise<string | null> {
  const queryClient = useQueryClient();
  return () =>
    queryClient.query({
      queryKey: commitKeys.headMessage(repoId),
      queryFn: () => unwrap(commands.getHeadMessage(repoId)),
      staleTime: 0,
    });
}
