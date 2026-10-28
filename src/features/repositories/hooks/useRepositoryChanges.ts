import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { reloadGraph } from "@/features/graph";
import { statusKeys } from "@/features/working-tree";
import { events, type RepoSummary, type RepositoryChanged } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { sessionKeys } from "../api/session";

/** The path of the open repository whose session is `id`. */
function sessionPath(queryClient: QueryClient, id: number): string | undefined {
  const sessions = queryClient.getQueriesData<RepoSummary>({ queryKey: sessionKeys.all });
  for (const [key, summary] of sessions) {
    const path = key[1];
    if (summary?.id === id && typeof path === "string") return path;
  }
  return undefined;
}

async function applyChange(queryClient: QueryClient, change: RepositoryChanged): Promise<void> {
  const path = sessionPath(queryClient, change.id);
  if (path === undefined) return;
  // A commit or checkout changes the index too, so refs changes re-read the status as well.
  void queryClient.invalidateQueries({ queryKey: statusKeys.summary(change.id) });
  if (!change.refs) return;
  const summary = await unwrap(commands.refreshRepository(change.id));
  queryClient.setQueryData(sessionKeys.byPath(path), summary);
  await reloadGraph(queryClient, change.id, path);
}

/**
 * Keeps open repositories current while they change outside the app: the backend watches each
 * one and reports what changed; this re-reads the status, HEAD and the graph.
 */
export function useRepositoryChanges(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const unlisten = events.repositoryChanged.listen(({ payload }) => {
      applyChange(queryClient, payload).catch((error: unknown) => {
        // The tab may have closed meanwhile; the next change or focus refreshes again.
        console.warn("Refreshing a changed repository failed", error);
      });
    });
    return () => {
      void unlisten.then((stop) => {
        stop();
      });
    };
  }, [queryClient]);
}
