import { FolderGitIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { RepositoryTab } from "@/features/workspace";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import type { RepoSummary } from "@/shared/ipc/bindings";

import { useActiveRepository } from "../hooks/useActiveRepository";

interface WithActiveRepositoryProps {
  /** What the module shows for the active repository. */
  children: (summary: RepoSummary, tab: RepositoryTab) => ReactNode;
}

/**
 * Shared frame of every module that works on the active repository: explains what is missing
 * (no repository open, still opening, failed) and otherwise renders `children`.
 */
export function WithActiveRepository({ children }: WithActiveRepositoryProps) {
  const active = useActiveRepository();
  if (!active.tab) {
    return (
      <EmptyState
        icon={FolderGitIcon}
        title="No repository open"
        description="Open a repository to see it here."
        className="h-full"
      />
    );
  }
  if (active.error) {
    return (
      <ErrorState
        error={active.error}
        title={`Could not open ${active.tab.title}`}
        className="h-full justify-center"
      />
    );
  }
  if (!active.summary) return <LoadingState label="Opening repository…" className="h-full" />;
  return children(active.summary, active.tab);
}
