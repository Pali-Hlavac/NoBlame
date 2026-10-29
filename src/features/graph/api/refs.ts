/** Branches, remote branches and tags of an open repository (from its graph). */
import { useQuery } from "@tanstack/react-query";

import { commands, unwrap } from "@/shared/ipc/client";

import { graphKeys } from "./graph";

/** Under the graph's keys, so they are dropped with the graph when the repository closes. */
export const refKeys = {
  all: (repoId: number) => [...graphKeys.all(repoId), "refs"] as const,
};

/** Every reference with the row of its commit (null when not shown). */
export function useRefs(repoId: number) {
  return useQuery({
    queryKey: refKeys.all(repoId),
    queryFn: () => unwrap(commands.listRefs(repoId)),
    staleTime: Infinity,
  });
}
