import { FilterXIcon, GitCommitHorizontalIcon } from "lucide-react";

import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import type { GraphSummary } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { NO_FILTER, useSetGraphFilter } from "../api/filter";
import { useGraphSummary } from "../api/graph";
import { FindBar } from "./FindBar";
import { GoToCommitDialog } from "./GoToCommitDialog";
import { GraphFilterBar } from "./GraphFilterBar";
import { GraphTable } from "./GraphTable";

interface GraphViewProps {
  repoId: number;
  repoPath: string;
}

/** Shown when the filter hides every commit. */
function NothingMatches({ repoId, repoPath }: GraphViewProps) {
  const setFilter = useSetGraphFilter(repoId, repoPath);
  return (
    <EmptyState
      icon={FilterXIcon}
      title="No commits match the filter"
      description="The branch may have been deleted, or the options leave nothing to show."
      action={
        <Button
          variant="outline"
          size="sm"
          disabled={setFilter.isPending}
          onClick={() => {
            setFilter.mutate(NO_FILTER);
          }}
        >
          Show all commits
        </Button>
      }
      className="h-full"
    />
  );
}

function GraphContent({ repoId, repoPath, summary }: GraphViewProps & { summary: GraphSummary }) {
  if (summary.rows === 0) return <NothingMatches repoId={repoId} repoPath={repoPath} />;
  // A new graph (after a commit, a fetch, a filter change) starts with fresh block caches.
  return (
    <GraphTable
      key={`${repoId}:${summary.generation}`}
      repoId={repoId}
      repoPath={repoPath}
      summary={summary}
    />
  );
}

/** The commit graph of one repository, with its filter bar and loading, error and empty states. */
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
  if (summary.data.totalRows === 0) {
    return (
      <EmptyState
        icon={GitCommitHorizontalIcon}
        title="No commits yet"
        description="Commits appear here once the repository has some."
        className="h-full"
      />
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <GraphFilterBar repoId={repoId} repoPath={repoPath} summary={summary.data} />
      <FindBar repoId={repoId} repoPath={repoPath} />
      <GoToCommitDialog repoId={repoId} repoPath={repoPath} />
      <div className="min-h-0 flex-1">
        <GraphContent repoId={repoId} repoPath={repoPath} summary={summary.data} />
      </div>
    </div>
  );
}
