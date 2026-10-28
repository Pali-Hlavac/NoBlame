/** The stash list of an open repository. */
import { useQuery } from "@tanstack/react-query";

import { graphKeys } from "@/features/graph";
import { commands, unwrap } from "@/shared/ipc/client";

/** Under the graph's keys, so they are dropped when the repository closes. */
export const stashKeys = {
  all: (repoId: number) => [...graphKeys.all(repoId), "stashes"] as const,
};

/** Stashes change outside the app (a terminal), so the list refreshes when the window regains focus. */
export function useStashes(repoId: number) {
  return useQuery({
    queryKey: stashKeys.all(repoId),
    queryFn: () => unwrap(commands.listStashes(repoId)),
    refetchOnWindowFocus: true,
  });
}
