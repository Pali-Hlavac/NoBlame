import { FileDiffIcon, MousePointerClickIcon } from "lucide-react";
import { useState } from "react";

import { WithActiveRepository } from "@/features/repositories";
import { selectFile, useSelectedFile, useSelection } from "@/features/selection";
import { WORKING_TREE_MILESTONE } from "@/features/working-tree";
import type { ChangedFileDto } from "@/shared/ipc/bindings";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { VirtualList } from "@/shared/components/VirtualList";

import { useChangedFiles } from "../api/changes";
import { describeFile } from "../lib/files";
import { ChangedFileRow } from "./ChangedFileRow";

/** Height of one row, in CSS pixels. */
const ROW_HEIGHT_PX = 26;

interface CommitFilesProps {
  repoId: number;
  repoPath: string;
  row: number;
}

function CommitFiles({ repoId, repoPath, row }: CommitFilesProps) {
  const [parent, setParent] = useState(0);
  const changes = useChangedFiles(repoId, row, parent);
  const chosen = useSelectedFile(repoPath);
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
  const activeIndex = files.findIndex(
    (file) => file.path === chosen?.path && file.newId === chosen.newId,
  );
  const choose = (file: ChangedFileDto | undefined): void => {
    if (!file) return;
    selectFile(repoPath, {
      path: file.path,
      previousPath: file.previousPath,
      oldId: file.oldId,
      newId: file.newId,
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1 text-xs text-muted-foreground">
        <span className="flex-1">
          {total === 1 ? "1 file changed" : `${total} files changed`}
          {total > files.length && ` (first ${files.length} shown)`}
        </span>
        {parentCount > 1 && (
          <label className="flex items-center gap-1">
            Compared with
            <select
              className="rounded border border-border bg-background px-1 py-0.5 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              value={parent}
              onChange={(event) => {
                setParent(Number(event.target.value));
                selectFile(repoPath, undefined);
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
      </div>
      {files.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">No files changed.</p>
      ) : (
        <VirtualList
          className="flex-1"
          label="Changed files"
          count={files.length}
          rowHeight={ROW_HEIGHT_PX}
          activeIndex={activeIndex < 0 ? undefined : activeIndex}
          onActiveChange={(index) => {
            choose(files[index]);
          }}
          onActivate={(index) => {
            choose(files[index]);
          }}
          rowLabel={(index) => {
            const file = files[index];
            return file ? describeFile(file) : "";
          }}
          renderRow={(index, active) => {
            const file = files[index];
            return file ? <ChangedFileRow file={file} active={active} /> : null;
          }}
        />
      )}
    </div>
  );
}

function SelectedChanges({ repoId, repoPath }: { repoId: number; repoPath: string }) {
  const selection = useSelection(repoPath);
  if (selection?.kind === "commit") {
    // Keyed by row: a new commit starts on its first parent.
    return (
      <CommitFiles key={selection.row} repoId={repoId} repoPath={repoPath} row={selection.row} />
    );
  }
  if (selection) {
    return (
      <EmptyState
        icon={FileDiffIcon}
        title="Uncommitted changes"
        description={`Their files and staging arrive in ${WORKING_TREE_MILESTONE}.`}
        className="h-full"
      />
    );
  }
  return (
    <EmptyState
      icon={MousePointerClickIcon}
      title="No commit selected"
      description="Select a commit to see the files it changed."
      className="h-full"
    />
  );
}

/** Changed files module: the files of the selected commit; choosing one shows its diff. */
export function ChangedFilesModule() {
  return (
    <WithActiveRepository>
      {(summary, tab) => <SelectedChanges repoId={summary.id} repoPath={tab.path} />}
    </WithActiveRepository>
  );
}
