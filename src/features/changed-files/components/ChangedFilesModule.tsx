import { MousePointerClickIcon } from "lucide-react";

import { useCommitDetails } from "@/features/commit-details";
import { WithActiveRepository } from "@/features/repositories";
import { compareWithParent, useComparedParent, useSelection } from "@/features/selection";
import { ErrorState } from "@/shared/components/ErrorState";
import { EmptyState } from "@/shared/components/EmptyState";
import { LoadingState } from "@/shared/components/LoadingState";

import { useChangedFiles } from "../api/changes";
import { fileCount } from "../lib/files";
import { FileList } from "./FileList";
import { WorkingTreeFiles } from "./WorkingTreeFiles";

interface CommitFilesProps {
  repoId: number;
  repoPath: string;
  row: number;
}

function CommitFiles({ repoId, repoPath, row }: CommitFilesProps) {
  const parent = useComparedParent(repoPath);
  const changes = useChangedFiles(repoId, row, parent);
  const details = useCommitDetails(repoId, row);
  // The previous commit's details stay while the next ones load: no Blame until they are in.
  const commit = details.isPlaceholderData ? undefined : details.data?.id;
  if (changes.error) {
    return (
      <ErrorState
        error={changes.error}
        title="Could not read the changes"
        onRetry={() => void changes.refetch()}
        className="h-full justify-center"
      />
    );
  }
  if (!changes.data) return <LoadingState label="Comparing…" className="h-full" />;
  const { files, total, parentCount } = changes.data;
  const header = (
    <>
      <span className="flex-1">
        {fileCount(total, "changed")}
        {total > files.length && ` (first ${files.length.toLocaleString()} shown)`}
      </span>
      {parentCount > 1 && (
        <label className="flex items-center gap-1">
          Compared with
          <select
            className="rounded border border-border bg-background px-1 py-0.5 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            value={parent}
            onChange={(event) => {
              compareWithParent(repoPath, Number(event.target.value));
            }}
          >
            {Array.from({ length: parentCount }, (_, index) => (
              <option key={index} value={index}>
                parent {index + 1}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
  return (
    <FileList
      repoId={repoId}
      repoPath={repoPath}
      files={files}
      header={header}
      empty="No files changed."
      // A deleted file's version is the one before.
      menuFile={(file) => ({
        path: file.path,
        blobId: file.newId ?? file.oldId,
        commit: file.status === "deleted" ? undefined : commit,
      })}
    />
  );
}

function SelectedChanges({ repoId, repoPath }: { repoId: number; repoPath: string }) {
  const selection = useSelection(repoPath);
  if (selection?.kind === "commit") {
    return <CommitFiles repoId={repoId} repoPath={repoPath} row={selection.row} />;
  }
  if (selection) {
    return <WorkingTreeFiles repoId={repoId} repoPath={repoPath} kind={selection.kind} />;
  }
  return (
    <EmptyState
      icon={MousePointerClickIcon}
      title="No commit selected"
      description="Select a commit, or the working tree changes above the commits, to see their files."
      className="h-full"
    />
  );
}

/**
 * Changed files module: the files of the selected commit, or of the selected working tree row
 * (changed or staged files); choosing one shows its diff.
 */
export function ChangedFilesModule() {
  return (
    <WithActiveRepository>
      {(summary, tab) => <SelectedChanges repoId={summary.id} repoPath={tab.path} />}
    </WithActiveRepository>
  );
}
