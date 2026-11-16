/** Submodules of a repository, nested; initializing and updating them as a job. */
import { type QueryClient, queryOptions, useQueries, useQuery } from "@tanstack/react-query";

import { afterJob, startJob } from "@/features/jobs";
import { commands, unwrap } from "@/shared/ipc/client";

export const submoduleKeys = {
  all: ["submodules"] as const,
  byPath: (path: string) => ["submodules", path] as const,
};

/** Submodules change rarely and outside the app, so they refresh when the window regains focus. */
export function submodulesQuery(path: string) {
  return queryOptions({
    queryKey: submoduleKeys.byPath(path),
    queryFn: () => unwrap(commands.listSubmodules(path)),
    refetchOnWindowFocus: true,
  });
}

/** `enabled: false` skips reading (a folder that no longer exists). */
export function useSubmodules(path: string, enabled = true) {
  return useQuery({ ...submodulesQuery(path), enabled });
}

/** Submodule trees of several repositories, in the same order as `paths`. */
export function useSubmoduleTrees(paths: readonly string[]) {
  return useQueries({ queries: paths.map(submodulesQuery) });
}

/**
 * Starts `git submodule update --init --recursive` in `parent` for the submodules at `paths`
 * (all of them when empty). The toast follows the job; the trees are read again when it ends.
 */
export function startSubmoduleUpdate(
  queryClient: QueryClient,
  parent: string,
  paths: readonly string[],
): void {
  const started = unwrap(commands.updateSubmodules(parent, [...paths]));
  startJob(started, "submoduleUpdate");
  started.then(
    (id) => {
      afterJob(id, () => void queryClient.invalidateQueries({ queryKey: submoduleKeys.all }));
    },
    // `startJob` says why it did not start.
    () => undefined,
  );
}

/** A working tree file that is a submodule checked out at another commit than recorded. */
export function isMovedSubmodule(file: {
  submodule: boolean;
  submoduleChanges: { newCommits: boolean } | null;
}): boolean {
  return file.submodule && file.submoduleChanges?.newCommits === true;
}
