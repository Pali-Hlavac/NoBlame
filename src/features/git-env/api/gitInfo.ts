/** Query hook for the git installation the app runs (path, version, support). */
import { useQuery } from "@tanstack/react-query";

import { commands, unwrap } from "@/shared/ipc/client";

export const gitInfoQueryKey = ["git-info"] as const;

/** Checked once per session; `refetch` checks again (e.g. after installing git). */
export function useGitInfo() {
  return useQuery({
    queryKey: gitInfoQueryKey,
    queryFn: () => unwrap(commands.getGitInfo()),
    staleTime: Infinity,
  });
}
