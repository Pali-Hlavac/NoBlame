import { useWorktreeFileId, type WorkingTreeKind } from "@/features/working-tree";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";

import type { DiffFile } from "../lib/diffFile";
import { FileDiffView } from "./FileDiffView";

interface DiskFileDiffProps {
  repoId: number;
  /** The old side as listed; the new side is the file at `file.path` on disk. */
  file: DiffFile;
  /** Lines can be staged or discarded (working tree rows only). */
  staging?: WorkingTreeKind | undefined;
}

/**
 * The diff of a file whose new side is the working tree file. The file is named by the id it
 * would have as a blob, so a new version on disk is a new diff. A submodule shows its pointers.
 */
export function DiskFileDiff({ repoId, file, staging }: DiskFileDiffProps) {
  const id = useWorktreeFileId(repoId, file.path, !file.submodule);
  if (file.submodule) return <FileDiffView repoId={repoId} file={file} />;
  if (id.error) {
    return (
      <ErrorState
        error={id.error}
        title="Could not read the file"
        onRetry={() => void id.refetch()}
        className="h-full justify-center"
      />
    );
  }
  if (id.data === undefined) return <LoadingState label="Reading the file…" className="h-full" />;
  return (
    <FileDiffView
      repoId={repoId}
      file={{ ...file, newId: id.data, worktree: true }}
      staging={staging}
    />
  );
}
