/**
 * Staging, unstaging and committing in an open repository, and what the message box offers: the
 * last commit's message, the configured author and template, recent messages.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { statusKeys, statusScope } from "@/features/working-tree";
import type { CommitRequestDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

export const commitKeys = {
  headMessage: (repoId: number) => ["commit", repoId, "head-message"] as const,
  defaults: (repoId: number) => ["commit", repoId, "defaults"] as const,
  recent: (repoId: number) => ["commit", repoId, "recent"] as const,
};

/** A change to the index: these paths (both names of a rename), or everything. */
export interface IndexChange {
  stage: boolean;
  /** `undefined`: everything. */
  paths?: readonly string[];
}

function runIndexChange(repoId: number, change: IndexChange): Promise<null> {
  const { stage } = change;
  // In a task window limited to a folder, "all" means all of that folder.
  const scope = statusScope();
  const paths = change.paths ?? (scope === null ? undefined : [scope]);
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
    meta: { activity: "Changing what is staged" },
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
    meta: { silent: true, activity: "Committing" },
    onSettled: async () => {
      queryClient.removeQueries({ queryKey: commitKeys.headMessage(repoId) });
      queryClient.removeQueries({ queryKey: commitKeys.recent(repoId) });
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

/**
 * The configured author, `commit.template` and comment character. Read when the box first shows
 * and again each time it mounts (config changes are rare, but cheap to pick up).
 */
export function useCommitDefaults(repoId: number) {
  return useQuery({
    queryKey: commitKeys.defaults(repoId),
    queryFn: () => unwrap(commands.getCommitDefaults(repoId)),
  });
}

/** The user's recent commit messages, read when the menu opens (a commit makes them stale). */
export function useRecentMessages(repoId: number, enabled: boolean) {
  return useQuery({
    queryKey: commitKeys.recent(repoId),
    queryFn: () => unwrap(commands.getRecentMessages(repoId)),
    enabled,
  });
}
