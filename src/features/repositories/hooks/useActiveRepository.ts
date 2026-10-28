import { useActiveRepositoryTab, type RepositoryTab } from "@/features/workspace";
import type { RepoSummary } from "@/shared/ipc/bindings";

import { useRepositorySession } from "../api/session";

export interface ActiveRepository {
  /** The repository tab focused most recently, if any is open. */
  tab: RepositoryTab | undefined;
  /** Its open session once it is ready. */
  summary: RepoSummary | undefined;
  isPending: boolean;
  error: Error | null;
}

/**
 * The active repository that modules and the toolbar act on: the repository tab focused most
 * recently, and its session (shared with the tab, never opened twice).
 */
export function useActiveRepository(): ActiveRepository {
  const tab = useActiveRepositoryTab();
  const session = useRepositorySession(tab?.path);
  return {
    tab,
    summary: session.data,
    isPending: tab !== undefined && session.isPending,
    error: session.error,
  };
}
