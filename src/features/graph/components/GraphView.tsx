import { GitCommitHorizontalIcon } from "lucide-react";

import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";

import { useGraphSummary } from "../api/graph";
import { GraphTable } from "./GraphTable";

interface GraphViewProps {
  repoId: number;
  repoPath: string;
}

/** The commit graph of one repository, with loading, error and empty states. */
export function GraphView({ repoId, repoPath }: GraphViewProps) {
  const summary = useGraphSummary(repoId);
  if (summary.isPending) return <LoadingState label="Reading history…" className="h-full" />;
  if (summary.error) {
    return (
      <ErrorState
        error={summary.error}
        title="Could not read the history"
        onRetry={() => void summary.refetch()}
        className="h-full justify-center"
      />
    );
  }
  if (summary.data.rows === 0) {
    return (
      <EmptyState
        icon={GitCommitHorizontalIcon}
        title="No commits yet"
        description="Commits appear here once the repository has some."
        className="h-full"
      />
    );
  }
  // A new build (after a commit, fetch, ...) starts with fresh block caches.
  return (
    <GraphTable
      key={`${repoId}:${summary.data.generation}`}
      repoId={repoId}
      repoPath={repoPath}
      summary={summary.data}
    />
  );
}
