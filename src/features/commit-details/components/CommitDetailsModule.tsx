import { MousePointerClickIcon } from "lucide-react";

import { WithActiveRepository } from "@/features/repositories";
import { useSelectedRow } from "@/features/selection";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";

import { useCommitDetails } from "../api/details";
import { CommitDetailsView } from "./CommitDetailsView";

function SelectedCommit({ repoId, repoPath }: { repoId: number; repoPath: string }) {
  const row = useSelectedRow(repoPath);
  const details = useCommitDetails(repoId, row);
  if (row === undefined) {
    return (
      <EmptyState
        icon={MousePointerClickIcon}
        title="No commit selected"
        description="Select a commit in the repository tab."
        className="h-full"
      />
    );
  }
  if (details.error) {
    return (
      <ErrorState
        error={details.error}
        title="Could not read the commit"
        onRetry={() => void details.refetch()}
        className="h-full justify-center"
      />
    );
  }
  if (!details.data) return <LoadingState label="Reading commit…" className="h-full" />;
  return <CommitDetailsView details={details.data} repoPath={repoPath} />;
}

/** Commit details module: follows the commit selected in the active repository. */
export function CommitDetailsModule() {
  return (
    <WithActiveRepository>
      {(summary, tab) => <SelectedCommit repoId={summary.id} repoPath={tab.path} />}
    </WithActiveRepository>
  );
}
