/** The blame of a file at a commit. */
import { useQuery } from "@tanstack/react-query";

import { commands, unwrap } from "@/shared/ipc/client";

import type { BlameTarget } from "../store/blame";

/** Keyed by commit id and path: the blame of a version never changes. */
export const blameKeys = {
  blame: (repoId: number, { commit, path }: BlameTarget) =>
    ["blame", repoId, commit, path] as const,
};

/** Hunks, their commits and the file's blob; read once per version. */
export function useBlame(repoId: number, target: BlameTarget) {
  return useQuery({
    queryKey: blameKeys.blame(repoId, target),
    queryFn: () => unwrap(commands.getBlame(repoId, target.commit, target.path)),
    staleTime: Infinity,
  });
}
