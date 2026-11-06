/**
 * The remotes to push to, and what a force push would take off a remote branch. Both live
 * under the refs' key, so a fetch or a config change reads them again.
 */
import { useQuery } from "@tanstack/react-query";

import { refKeys } from "@/features/graph";
import { useRepositoryPath } from "@/features/repositories";
import { commands, unwrap } from "@/shared/ipc/client";

export const remoteKeys = {
  list: (repoId: number) => [...refKeys.all(repoId), "remotes"] as const,
  missing: (repoId: number, revision: string, notIn: string) =>
    [...refKeys.all(repoId), "missing", revision, notIn] as const,
};

/** The repository's remotes, sorted. */
export function useRemotes(repoId: number) {
  const path = useRepositoryPath(repoId);
  return useQuery({
    queryKey: remoteKeys.list(repoId),
    queryFn: () => {
      if (path === undefined) throw new Error("the repository is not open");
      return unwrap(commands.listRemotes(path));
    },
    enabled: path !== undefined,
    staleTime: Infinity,
  });
}

/**
 * Commits on `revision` (a remote branch's full name) that `notIn` (a local branch's) lacks:
 * what forcing would remove. Not asked while `revision` is null.
 */
export function useMissingCommits(repoId: number, revision: string | null, notIn: string) {
  return useQuery({
    queryKey: remoteKeys.missing(repoId, revision ?? "", notIn),
    queryFn: () => {
      if (revision === null) throw new Error("nothing to compare");
      return unwrap(commands.getMissingCommits(repoId, revision, notIn));
    },
    enabled: revision !== null,
    staleTime: 0,
    gcTime: 0,
  });
}
