/** The commits between a submodule's two pointers, read in its own clone. */
import { useQuery } from "@tanstack/react-query";

import { submoduleKeys } from "@/features/repositories";
import { statusKeys } from "@/features/working-tree";
import { commands, unwrap } from "@/shared/ipc/client";

/**
 * The commits between `from` and `to` of the submodule at `path` (`to: null`: what it has
 * checked out). The working tree's version is keyed under the status, so it is read again
 * whenever the status is; the others under the submodule trees, which a submodule update
 * reads again (it may clone the submodule or fetch the commits).
 */
export function useSubmoduleLog(
  repoId: number,
  path: string,
  from: string,
  to: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey:
      to === null
        ? [...statusKeys.all(repoId), "submodule-log", path, from]
        : [...submoduleKeys.all, "log", repoId, path, from, to],
    queryFn: () => unwrap(commands.getSubmoduleLog(repoId, path, from, to)),
    enabled,
  });
}
