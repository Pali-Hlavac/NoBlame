/**
 * Upstreams of local branches and their ahead/behind counts. Every branch's upstream is read at
 * once (cheap); counts are asked only for the branches on screen, since counting thousands of
 * diverged branches takes seconds. Both live under the refs' key: a graph reload (refs moved)
 * and a config change (the watcher) refetch them.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { refKeys } from "@/features/graph";
import type { SetUpstreamRequestDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

export const upstreamKeys = {
  list: refKeys.upstreams,
  tracking: (repoId: number, branches: readonly string[]) =>
    [...refKeys.all(repoId), "tracking", ...branches] as const,
};

/** Every local branch with an upstream. */
export function useUpstreams(repoId: number) {
  return useQuery({
    queryKey: upstreamKeys.list(repoId),
    queryFn: () => unwrap(commands.getUpstreams(repoId)),
    staleTime: Infinity,
  });
}

/**
 * Ahead and behind for `branches` (the ones shown that have an upstream). While a new set is
 * counted the previous counts stay, so scrolling does not blank the rows that stayed.
 */
export function useAheadBehind(repoId: number, branches: readonly string[]) {
  return useQuery({
    queryKey: upstreamKeys.tracking(repoId, branches),
    queryFn: () => unwrap(commands.getAheadBehind(repoId, [...branches])),
    enabled: branches.length > 0,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
}

/** Sets or removes a branch's upstream. Errors are shown by the caller (with git's words). */
export function useSetUpstream(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SetUpstreamRequestDto) => unwrap(commands.setUpstream(repoId, request)),
    meta: { silent: true, activity: "Setting the upstream" },
    // The watcher reports the config change too; this is quicker and works without it.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: upstreamKeys.list(repoId) }),
        queryClient.invalidateQueries({ queryKey: [...refKeys.all(repoId), "tracking"] }),
      ]),
  });
}
