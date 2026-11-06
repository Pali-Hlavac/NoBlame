import { useQueryClient } from "@tanstack/react-query";

import type { RepoSummary } from "@/shared/ipc/bindings";

import { sessionKeys } from "../api/session";

/**
 * The folder of open repository session `repoId` (its work tree, or the repository when bare),
 * for commands that take a path (background jobs). `undefined` once the tab closed.
 */
export function useRepositoryPath(repoId: number): string | undefined {
  const queryClient = useQueryClient();
  const sessions = queryClient.getQueriesData<RepoSummary>({ queryKey: sessionKeys.all });
  return sessions.find(([, summary]) => summary?.id === repoId)?.[1]?.path;
}
