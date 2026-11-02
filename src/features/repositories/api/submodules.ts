/** Submodules of a repository, nested. */
import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";

import { commands, unwrap } from "@/shared/ipc/client";

export const submoduleKeys = {
  byPath: (path: string) => ["submodules", path] as const,
};

/** Submodules change rarely and outside the app, so they refresh when the window regains focus. */
function submodulesQuery(path: string) {
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
