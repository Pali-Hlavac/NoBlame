import { BinaryIcon, EqualIcon, FileWarningIcon, PackageIcon } from "lucide-react";
import { useRef, type RefObject } from "react";

import { shortId } from "@/features/graph";
import { requestedContext, useDiffSettings } from "@/features/settings";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingOverlay } from "@/shared/components/LoadingOverlay";
import { LoadingState } from "@/shared/components/LoadingState";
import type { ChangedFileDto } from "@/shared/ipc/bindings";

import type { DiffRequest } from "../api/diff";
import { useShownDiff, viewKey, type ShownDiff } from "../hooks/useShownDiff";
import { formatBytes, unchangedText } from "../lib/format";
import { imageType } from "../lib/images";
import { DiffHeader } from "./DiffHeader";
import { DiffLines } from "./DiffLines";
import { ImageDiff } from "./ImageDiff";

interface DiffBodyProps {
  shown: ShownDiff;
  file: ChangedFileDto;
  viewport: RefObject<HTMLDivElement | null>;
}

function DiffBody({ shown, file, viewport }: DiffBodyProps) {
  const { request, diff, layout, scrollTop } = shown;
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
        description={unchangedText(file, request.options.whitespace)}
        className="flex-1"
      />
    );
  }
  return (
    <DiffLines
      request={request}
      diff={diff}
      layout={layout}
      label={`Diff of ${file.path}`}
      viewport={viewport}
      scrollTop={scrollTop}
    />
  );
}

/**
 * The diff of one changed file of the selected commit. Changing the options or the layout keeps
 * the old diff under an overlay until the new one is ready, then opens it at the same line.
 */
export function FileDiffView({ repoId, file }: { repoId: number; file: ChangedFileDto }) {
  const [settings] = useDiffSettings();
  const request: DiffRequest = {
    repoId,
    oldId: file.oldId,
    newId: file.newId,
    path: file.path,
    options: {
      whitespace: settings.whitespace,
      context: requestedContext(settings),
      syntax: settings.syntaxHighlighting,
    },
  };
  const viewport = useRef<HTMLDivElement>(null);
  // A submodule entry points at a commit, not at file contents.
  const { shown, pending, summary } = useShownDiff(
    request,
    settings.layout,
    viewport,
    !file.submodule,
  );
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
  } else if (summary.error) {
    body = (
      <ErrorState
        error={summary.error}
        title="Could not compare the file"
        onRetry={() => void summary.refetch()}
        className="flex-1 justify-center"
      />
    );
  } else if (!shown) {
    body = <LoadingState label="Comparing…" className="flex-1" />;
  } else {
    body = (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <DiffBody
          key={viewKey(shown.request, shown.layout)}
          shown={shown}
          file={file}
          viewport={viewport}
        />
        {pending && <LoadingOverlay label="Comparing…" />}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <DiffHeader file={file} diff={summary.data ?? shown?.diff} />
      {body}
    </div>
  );
}
