import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { SubmoduleDto } from "@/shared/ipc/bindings";

import { startSubmoduleUpdate } from "../api/submodules";
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
