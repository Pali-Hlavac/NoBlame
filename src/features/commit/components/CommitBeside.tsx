import { MousePointerClickIcon } from "lucide-react";

import { WorkingTreeDiff } from "@/features/diff";
import { useSelectedFile, useSelection } from "@/features/selection";
import type { RepoSummary } from "@/shared/ipc/bindings";
import { EmptyState } from "@/shared/components/EmptyState";

import { commitTitle } from "../lib/title";
import { CommitPanel } from "./CommitPanel";

/** The diff of the file chosen in the lists. */
function ChosenDiff({ repoId, repoPath }: { repoId: number; repoPath: string }) {
  const selection = useSelection(repoPath);
  const path = useSelectedFile(repoPath);
  if (selection?.kind === "commit" || selection === undefined || path === undefined) {
    return (
      <EmptyState
        icon={MousePointerClickIcon}
        title="No file chosen"
        description="Choose a changed or staged file to see its diff."
        className="h-full"
      />
    );
  }
  return <WorkingTreeDiff repoId={repoId} kind={selection.kind} path={path} />;
}

interface CommitBesideProps {
  summary: RepoSummary;
  repoPath: string;
  onCommitted: (output: string) => void;
}

/**
 * The Commit module popped out: the lists and the message, with the chosen file's diff beside
 * them (the diff tab is behind the popup).
 */
export function CommitBeside({ summary, repoPath, onCommitted }: CommitBesideProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-baseline gap-2 border-b border-border px-3 py-1.5 text-sm">
        <span className="font-medium">{commitTitle(summary.head)}</span>
        <span className="truncate text-muted-foreground">{summary.path}</span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(18rem,26rem)_1fr]">
        <div className="min-h-0 border-r border-border">
          <CommitPanel
            repoId={summary.id}
            repoPath={repoPath}
            showDiff={false}
            onCommitted={onCommitted}
          />
        </div>
        <div className="min-h-0 min-w-0">
          <ChosenDiff repoId={summary.id} repoPath={repoPath} />
        </div>
      </div>
    </div>
  );
}
