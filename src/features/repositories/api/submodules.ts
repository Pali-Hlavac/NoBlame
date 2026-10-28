/** Submodules of a repository, nested. */
import { useQuery } from "@tanstack/react-query";

import { commands, unwrap } from "@/shared/ipc/client";

export const submoduleKeys = {
  byPath: (path: string) => ["submodules", path] as const,
};

/** Submodules change rarely and outside the app, so they refresh when the window regains focus. */
export function useSubmodules(path: string) {
  return useQuery({
    queryKey: submoduleKeys.byPath(path),
    queryFn: () => unwrap(commands.listSubmodules(path)),
    refetchOnWindowFocus: true,
  });
}
