import { FolderXIcon } from "lucide-react";

import { isMovedSubmodule, useCheckOutRecorded } from "@/features/repositories";
import {
  filesOf,
  totalOf,
  useWorkingTreeStatus,
  type WorkingTreeKind,
} from "@/features/working-tree";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";

import { fileCount } from "../lib/files";
import { FileList } from "./FileList";

interface WorkingTreeFilesProps {
  repoId: number;
  repoPath: string;
  kind: WorkingTreeKind;
}

/** The files of a working tree row: changed, untracked and conflicted ones, or staged ones. */
export function WorkingTreeFiles({ repoId, repoPath, kind }: WorkingTreeFilesProps) {
  const status = useWorkingTreeStatus(repoId);
  const checkOutRecorded = useCheckOutRecorded(repoPath);
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
  if (status.data === null) {
    return (
      <EmptyState
        icon={FolderXIcon}
        title="No working tree"
        description="A bare repository has no files to change."
        className="h-full"
      />
    );
  }
  const files = filesOf(status.data, kind);
  const total = totalOf(status.data.summary, kind);
  return (
    <FileList
      repoId={repoId}
      repoPath={repoPath}
      menuFile={(file) => ({ path: file.path })}
      moreActions={(file) =>
        isMovedSubmodule(file)
          ? [
              {
                label: "Check out the recorded commit",
                onSelect: () => {
                  checkOutRecorded([file.path]);
                },
              },
            ]
          : []
      }
      files={files}
      header={
        <span className="flex-1">
          {fileCount(total, kind === "index" ? "staged" : "changed")}
          {total > files.length && ` (first ${files.length.toLocaleString()} shown)`}
        </span>
      }
      empty={kind === "index" ? "Nothing is staged." : "No changes in the working tree."}
    />
  );
}
