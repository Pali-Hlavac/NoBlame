import { BinaryIcon, EqualIcon, FileWarningIcon, PackageIcon } from "lucide-react";

import { STATUS_LABELS, splitPath } from "@/features/changed-files";
import { shortId } from "@/features/graph";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import type { ChangedFileDto, FileDiffDto } from "@/shared/ipc/bindings";

import { useFileDiff } from "../api/diff";
import { formatBytes, formatChangeCounts } from "../lib/format";
import { DiffLines } from "./DiffLines";

/** File name, folder, old name of a rename, status and line counts. */
function DiffHeader({ file, diff }: { file: ChangedFileDto; diff: FileDiffDto | undefined }) {
  const { name, folder } = splitPath(file.path);
  return (
    <div className="flex shrink-0 flex-wrap items-baseline gap-x-2 border-b border-border px-3 py-1.5 text-sm">
      <span className="font-medium">{name}</span>
      <span className="min-w-0 truncate text-xs text-muted-foreground">
        {file.previousPath
          ? `${STATUS_LABELS[file.status].word} from ${file.previousPath}`
          : folder}
      </span>
      <span className="ml-auto flex gap-2 text-xs text-muted-foreground">
        {!file.previousPath && <span>{STATUS_LABELS[file.status].word}</span>}
        {diff?.content === "text" && diff.rows > 0 && (
          <span className="font-mono">{formatChangeCounts(diff.additions, diff.deletions)}</span>
        )}
      </span>
    </div>
  );
}

/** Why there are no rows although the file is listed as changed. */
function unchangedText(file: ChangedFileDto): string {
  if (file.oldId === file.newId) {
    return file.previousPath
      ? "The file was moved; its contents did not change."
      : "Only the file mode changed (for example the executable bit).";
  }
  return file.status === "added" ? "The new file is empty." : "The removed file was empty.";
}

function DiffBody({
  repoId,
  file,
  diff,
}: {
  repoId: number;
  file: ChangedFileDto;
  diff: FileDiffDto;
}) {
  const sizes = `${formatBytes(Number(diff.oldSize))} → ${formatBytes(Number(diff.newSize))}`;
  if (diff.content === "binary") {
    return (
      <EmptyState
        icon={BinaryIcon}
        title="Binary file"
        description={`${sizes}. Images and binary files get their own view in a later M3 slice.`}
        className="flex-1"
      />
    );
  }
  if (diff.content === "tooLarge") {
    return (
      <EmptyState
        icon={FileWarningIcon}
        title="Too large to compare"
        description={`${sizes}. Files over 64 MB are not compared.`}
        className="flex-1"
      />
    );
  }
  if (diff.rows === 0) {
    return (
      <EmptyState
        icon={EqualIcon}
        title="No changed lines"
        description={unchangedText(file)}
        className="flex-1"
      />
    );
  }
  return (
    <DiffLines
      repoId={repoId}
      oldId={file.oldId}
      newId={file.newId}
      diff={diff}
      label={`Diff of ${file.path}`}
    />
  );
}

/** The diff of one changed file of the selected commit. */
export function FileDiffView({ repoId, file }: { repoId: number; file: ChangedFileDto }) {
  // A submodule entry points at a commit, not at file contents.
  const diff = useFileDiff(repoId, file.oldId, file.newId, !file.submodule);
  let body;
  if (file.submodule) {
    const from = file.oldId ? shortId(file.oldId) : "nothing";
    const to = file.newId ? shortId(file.newId) : "nothing";
    body = (
      <EmptyState
        icon={PackageIcon}
        title="Submodule"
        description={`Its commit changed from ${from} to ${to}.`}
        className="flex-1"
      />
    );
  } else if (diff.error) {
    body = (
      <ErrorState
        error={diff.error}
        title="Could not compare the file"
        onRetry={() => void diff.refetch()}
        className="flex-1 justify-center"
      />
    );
  } else if (!diff.data) {
    body = <LoadingState label="Comparing…" className="flex-1" />;
  } else {
    body = <DiffBody repoId={repoId} file={file} diff={diff.data} />;
  }
  return (
    <div className="flex h-full flex-col">
      <DiffHeader file={file} diff={diff.data} />
      {body}
    </div>
  );
}
