import { FileCheckIcon } from "lucide-react";

import { filesOf, useWorkingTreeStatus, type WorkingTreeKind } from "@/features/working-tree";
import type { WorkingFileDto } from "@/shared/ipc/bindings";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";

import { DiskFileDiff } from "./DiskFileDiff";
import { FileDiffView } from "./FileDiffView";

/** Lines can be staged (or discarded) unless the file is in conflict or a submodule. */
function stagingOf(file: WorkingFileDto, kind: WorkingTreeKind): WorkingTreeKind | undefined {
  return file.status === "conflicted" || file.submodule ? undefined : kind;
}

interface WorkingTreeDiffProps {
  repoId: number;
  kind: WorkingTreeKind;
  path: string;
}

/**
 * The diff of a file of a working tree row: staged files compare HEAD with the index, the others
 * compare the index (or "ours", in a conflict) with the file as git would store it.
 */
export function WorkingTreeDiff({ repoId, kind, path }: WorkingTreeDiffProps) {
  const status = useWorkingTreeStatus(repoId);
  if (status.error) {
    return (
      <ErrorState
        error={status.error}
        title="Could not read the status"
        onRetry={() => void status.refetch()}
        className="h-full justify-center"
      />
    );
  }
  if (status.data === undefined)
    return <LoadingState label="Reading the status…" className="h-full" />;
  const file = status.data && filesOf(status.data, kind).find((listed) => listed.path === path);
  if (!file) {
    return (
      <EmptyState
        icon={FileCheckIcon}
        title={kind === "index" ? "Not staged" : "No changes"}
        description={`${path} has no ${kind === "index" ? "staged changes" : "changes in the working tree"}. Choose a file in Changed files.`}
        className="h-full"
      />
    );
  }
  if (!file.worktree) {
    return <FileDiffView repoId={repoId} file={file} staging={stagingOf(file, kind)} />;
  }
  return (
    <DiskFileDiff
      key={file.path}
      repoId={repoId}
      file={file}
      staging={stagingOf(file, "worktree")}
    />
  );
}
