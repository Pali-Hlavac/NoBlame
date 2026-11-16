import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { SubmoduleDto } from "@/shared/ipc/bindings";

import { startSubmoduleUpdate, submodulesQuery } from "../api/submodules";
import { withNewCommits } from "../lib/submodules";
import { useSubmoduleUpdateStore } from "../store/submoduleUpdate";

/**
 * Initializes or updates submodules of `parent`: `submodules` (with their nested ones), or all
 * of them when `all`. When some are checked out at other commits than the recorded ones, the
 * update would move them, so it asks first (`SubmoduleUpdateDialog`).
 */
export function useSubmoduleUpdate(): (
  parent: string,
  submodules: readonly SubmoduleDto[],
  all: boolean,
) => void {
  const queryClient = useQueryClient();
  return useCallback(
    (parent, submodules, all) => {
      const paths = all ? [] : submodules.map((submodule) => submodule.path);
      const moved = withNewCommits(submodules);
      if (moved.length === 0) startSubmoduleUpdate(queryClient, parent, paths);
      else useSubmoduleUpdateStore.getState().setRequest({ parent, paths, moved });
    },
    [queryClient],
  );
}

/**
 * **Check out the recorded commit**: moves the submodules at `paths` of the repository at
 * `repoPath` back to the commits it records, as a job, after the same question (they have new
 * commits). The submodule list is read fresh for the question's commits.
 */
export function useCheckOutRecorded(repoPath: string): (paths: readonly string[]) => void {
  const queryClient = useQueryClient();
  const update = useSubmoduleUpdate();
  return useCallback(
    (paths) => {
      queryClient.query({ ...submodulesQuery(repoPath), staleTime: 0 }).then(
        (submodules) => {
          const chosen = submodules.filter((submodule) => paths.includes(submodule.path));
          if (chosen.length === 0) startSubmoduleUpdate(queryClient, repoPath, paths);
          else update(repoPath, chosen, false);
        },
        // Unreadable list: git still says what it moved (and refuses what is in the way).
        () => {
          startSubmoduleUpdate(queryClient, repoPath, paths);
        },
      );
    },
    [queryClient, repoPath, update],
  );
}
