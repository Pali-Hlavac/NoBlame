/**
 * Repository sessions. A session is opened when a repository tab first renders and closed when
 * the tab closes (see `useSessionCleanup`), not when the tab is merely hidden.
 */
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { graphKeys } from "@/features/graph";
import { useSelectionStore } from "@/features/selection";
import type { RepoSummary } from "@/shared/ipc/bindings";
import { call, commands, unwrap } from "@/shared/ipc/client";

import { changeCountKeys } from "./changeCounts";
import { recentKeys } from "./recent";

export const sessionKeys = {
  all: ["repository-session"] as const,
  byPath: (path: string) => ["repository-session", path] as const,
};

/** Opens (once) the repository behind a tab; `undefined` waits until there is one. */
export function useRepositorySession(path: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: sessionKeys.byPath(path ?? ""),
    enabled: path !== undefined,
    queryFn: async () => {
      if (path === undefined) throw new Error("no repository path");
      const summary = await unwrap(commands.openRepository(path));
      void queryClient.invalidateQueries({ queryKey: recentKeys.all });
      return summary;
    },
    staleTime: Infinity,
    // Never garbage-collect: refetching would open a second backend session.
    gcTime: Infinity,
  });
}

/** Closes the backend session of `path` and forgets everything cached for it. */
export async function closeRepositorySession(
  queryClient: QueryClient,
  path: string,
): Promise<void> {
  const summary = queryClient.getQueryData<RepoSummary>(sessionKeys.byPath(path));
  queryClient.removeQueries({ queryKey: sessionKeys.byPath(path) });
  useSelectionStore.getState().clear(path);
  // Counted from the session's status while open; closed, it runs `git status` again.
  void queryClient.invalidateQueries({ queryKey: changeCountKeys.byPath(path) });
  if (!summary) return;
  queryClient.removeQueries({ queryKey: graphKeys.all(summary.id) });
  await call(commands.closeRepository(summary.id));
}
