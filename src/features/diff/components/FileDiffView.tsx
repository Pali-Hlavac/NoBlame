import { BinaryIcon, EqualIcon, FileWarningIcon, PackageIcon } from "lucide-react";

import { shortId } from "@/features/graph";
import { useDiffSettings } from "@/features/settings";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import type { ChangedFileDto, FileDiffDto } from "@/shared/ipc/bindings";

import { useFileDiff, type DiffRequest } from "../api/diff";
import { formatBytes, unchangedText } from "../lib/format";
import { imageType } from "../lib/images";
import { DiffHeader } from "./DiffHeader";
import { DiffLines } from "./DiffLines";
import { ImageDiff } from "./ImageDiff";

interface DiffBodyProps {
  request: DiffRequest;
  file: ChangedFileDto;
  diff: FileDiffDto;
}

function DiffBody({ request, file, diff }: DiffBodyProps) {
  const [settings] = useDiffSettings();
  const sizes = `${formatBytes(Number(diff.oldSize))} → ${formatBytes(Number(diff.newSize))}`;
  const image = imageType(file.path);
  if (diff.content === "binary" && image) {
    return <ImageDiff repoId={request.repoId} file={file} diff={diff} type={image} />;
  }
  if (diff.content === "binary") {
    return (
      <EmptyState
        icon={BinaryIcon}
        title="Binary file"
        description={`${sizes}. Binary files have no line diff; images are shown as pictures.`}
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
        description={unchangedText(file, settings.whitespace)}
        className="flex-1"
      />
    );
  }
  return (
    <DiffLines
      request={request}
      diff={diff}
      layout={settings.layout}
      label={`Diff of ${file.path}`}
    />
  );
}

/** The diff of one changed file of the selected commit. */
export function FileDiffView({ repoId, file }: { repoId: number; file: ChangedFileDto }) {
  const [settings] = useDiffSettings();
  const request: DiffRequest = {
    repoId,
    oldId: file.oldId,
    newId: file.newId,
    path: file.path,
    options: { whitespace: settings.whitespace, context: settings.contextLines },
  };
  // A submodule entry points at a commit, not at file contents.
  const diff = useFileDiff(request, !file.submodule);
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
    body = <DiffBody request={request} file={file} diff={diff.data} />;
  }
  return (
    <div className="flex h-full flex-col">
      <DiffHeader file={file} diff={diff.data} />
      {body}
    </div>
  );
}
