/** The working tree status summary of an open repository. */
import { useQuery } from "@tanstack/react-query";

import { commands, unwrap } from "@/shared/ipc/client";

export const statusKeys = {
  all: ["status"] as const,
  summary: (repoId: number) => ["status", repoId, "summary"] as const,
};

/**
 * Staged, changed, untracked and conflicted counts (`null` for a bare repository). The working
 * tree changes outside the app, so it is read again whenever the window regains focus; the
 * file watcher (M2) will refresh it as files change.
 */
export function useStatusSummary(repoId: number, enabled = true) {
  return useQuery({
    queryKey: statusKeys.summary(repoId),
    queryFn: () => unwrap(commands.getStatusSummary(repoId)),
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
}
