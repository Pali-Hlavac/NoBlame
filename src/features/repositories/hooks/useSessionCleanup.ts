import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useTabsStore, type WorkspaceTab } from "@/features/workspace";

import { closeRepositorySession } from "../api/session";

function repositoryPaths(tabs: readonly WorkspaceTab[]): Set<string> {
  return new Set(tabs.flatMap((tab) => (tab.kind === "repository" ? [tab.path] : [])));
}

/** Closes the backend session of every repository tab that gets closed. Mount once. */
export function useSessionCleanup(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    let open = repositoryPaths(useTabsStore.getState().tabs);
    return useTabsStore.subscribe((state) => {
      const next = repositoryPaths(state.tabs);
      for (const path of open) {
        if (!next.has(path)) {
          closeRepositorySession(queryClient, path).catch((error: unknown) => {
            console.warn("Closing a repository session failed", error);
          });
        }
      }
      open = next;
    });
  }, [queryClient]);
}
