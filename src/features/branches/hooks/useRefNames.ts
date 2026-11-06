import { useMemo } from "react";

import { useRefs } from "@/features/graph";

/** The local branch, remote branch and tag names of the repository, for checking names. */
export function useRefNames(repoId: number) {
  const refs = useRefs(repoId).data;
  return useMemo(() => {
    const branches = new Set<string>();
    const tags = new Set<string>();
    const remotes = new Set<string>();
    for (const entry of refs ?? []) {
      if (entry.label.kind === "branch") branches.add(entry.label.name);
      else if (entry.label.kind === "tag") tags.add(entry.label.name);
      else if (entry.label.kind === "remote") remotes.add(entry.label.name);
    }
    return { branches, tags, remotes, loaded: refs !== undefined };
  }, [refs]);
}
