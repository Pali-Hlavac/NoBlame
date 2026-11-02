import { GitCompareArrowsIcon } from "lucide-react";
import { useEffect } from "react";

import { WithActiveRepository } from "@/features/repositories";
import { compare, useComparison } from "@/features/selection";
import { COMPARE_TAB, useTabsStore } from "@/features/workspace";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingOverlay } from "@/shared/components/LoadingOverlay";
import { LoadingState } from "@/shared/components/LoadingState";
import { toIpcError } from "@/shared/ipc/client";

import { useComparisonFiles } from "../api/compare";
import { NO_COMPARISON, isComplete, revisionLabel } from "../lib/revisions";
import { CompareFiles } from "./CompareFiles";
import { CompareHeader } from "./CompareHeader";

interface ComparisonProps {
  repoId: number;
  repoPath: string;
}

/** One repository's comparison: both revisions, the files that differ, the chosen diff. */
export function ComparisonView({ repoId, repoPath }: ComparisonProps) {
  const comparison = useComparison(repoPath) ?? NO_COMPARISON;
  const files = useComparisonFiles(repoId, comparison);
  const complete = isComplete(comparison);

  // A newer comparison cancels the one running; when the user comes back to a cancelled one,
  // read it again instead of showing the cancellation.
  const cancelled = files.error !== null && toIpcError(files.error).code === "CANCELLED";
  const { refetch } = files;
  useEffect(() => {
    if (cancelled) void refetch({ cancelRefetch: false });
  }, [cancelled, refetch]);

  useEffect(() => {
    const title = complete
      ? `Compare: ${revisionLabel(comparison.base)} → ${revisionLabel(comparison.target)}`
      : "Compare";
    useTabsStore.getState().setTitle(COMPARE_TAB.id, title);
  }, [complete, comparison.base, comparison.target]);

  let body;
  if (!complete) {
    body = (
      <EmptyState
        icon={GitCompareArrowsIcon}
        title="Choose what to compare"
        description="Pick a branch, tag or commit on both sides. In the graph, right-click a commit and choose Compare with HEAD, or Ctrl+click a second commit."
        className="flex-1"
      />
    );
  } else if (files.error && !cancelled) {
    body = (
      <ErrorState
        error={files.error}
        title="Could not compare"
        onRetry={() => void refetch()}
        className="flex-1 justify-center"
      />
    );
  } else if (!files.data) {
    body = <LoadingState label="Comparing…" className="flex-1" />;
  } else {
    body = (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <CompareFiles repoId={repoId} repoPath={repoPath} result={files.data} />
        {files.isPlaceholderData && <LoadingOverlay label="Comparing…" />}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <CompareHeader
        repoId={repoId}
        comparison={comparison}
        onChange={(next) => {
          compare(repoPath, next);
        }}
        result={files.isPlaceholderData ? undefined : files.data}
      />
      {body}
    </div>
  );
}

/**
 * The compare tab: the files that differ between two revisions of the active repository, and
 * the diff of the chosen one. There is one; comparing other revisions switches it in place.
 */
export function CompareView() {
  return (
    <WithActiveRepository>
      {(summary, tab) => (
        // One per repository: the last comparison shown stays while the next one loads.
        <ComparisonView key={tab.path} repoId={summary.id} repoPath={tab.path} />
      )}
    </WithActiveRepository>
  );
}
