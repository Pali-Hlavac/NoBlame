import { FolderTreeIcon, MousePointerClickIcon } from "lucide-react";

import { useCommitDetails } from "@/features/commit-details";
import { shortId } from "@/features/graph";
import { WithActiveRepository } from "@/features/repositories";
import { useSelection } from "@/features/selection";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";

import { useTreeEntry } from "../api/tree";
import { FileFilter } from "./FileFilter";
import { FileTree } from "./FileTree";

interface CommitFilesProps {
  repoId: number;
  repoPath: string;
  row: number;
}

function CommitFiles({ repoId, repoPath, row }: CommitFilesProps) {
  const root = useTreeEntry(repoId, row, "");
  const details = useCommitDetails(repoId, row);
  if (root.error) {
    return (
      <ErrorState
        error={root.error}
        title="Could not read the files"
        onRetry={() => void root.refetch()}
        className="h-full justify-center"
      />
    );
  }
  if (!root.data) return <LoadingState label="Reading the files…" className="h-full" />;
  const commit = details.data ? shortId(details.data.id) : undefined;
  const label = commit ? `Files at ${commit}` : "Files";
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1 text-xs text-muted-foreground">
        <span className="shrink-0">
          {commit ? (
            <>
              Files at <span className="font-mono">{commit}</span>
            </>
          ) : (
            "Files"
          )}
        </span>
        <FileFilter repoPath={repoPath} />
      </div>
      <FileTree
        repoId={repoId}
        repoPath={repoPath}
        rootId={root.data.id}
        commit={details.data?.id}
        label={label}
      />
    </div>
  );
}

function SelectedFiles({ repoId, repoPath }: { repoId: number; repoPath: string }) {
  const selection = useSelection(repoPath);
  if (selection?.kind === "commit") {
    return <CommitFiles repoId={repoId} repoPath={repoPath} row={selection.row} />;
  }
  return (
    <EmptyState
      icon={selection ? FolderTreeIcon : MousePointerClickIcon}
      title={selection ? "Uncommitted changes" : "No commit selected"}
      description="Select a commit to browse its files."
      className="h-full"
    />
  );
}

/**
 * Files module: the folders and files of the selected commit. Showing a file opens it in the
 * file tab; open folders and the chosen file stay when another commit is selected.
 */
export function FilesModule() {
  return (
    <WithActiveRepository>
      {(summary, tab) => <SelectedFiles repoId={summary.id} repoPath={tab.path} />}
    </WithActiveRepository>
  );
}
