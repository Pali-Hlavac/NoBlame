import { BinaryIcon, EqualIcon, FileWarningIcon } from "lucide-react";
import { useRef, type RefObject } from "react";

import { requestedContext, useDiffSettings } from "@/features/settings";
import type { WorkingTreeKind } from "@/features/working-tree";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingOverlay } from "@/shared/components/LoadingOverlay";
import { LoadingState } from "@/shared/components/LoadingState";

import type { DiffRequest } from "../api/diff";
import { LineStagingContext, useLineStaging } from "../hooks/useLineStaging";
import { useShownDiff, viewKey, type ShownDiff } from "../hooks/useShownDiff";
import type { DiffFile } from "../lib/diffFile";
import { formatBytes, unchangedText } from "../lib/format";
import { imageType } from "../lib/images";
import { DiffHeader } from "./DiffHeader";
import { DiffLines } from "./DiffLines";
import { LineSelectionBar } from "./LineSelectionBar";
import { ImageDiff } from "./ImageDiff";
import { SubmoduleDiff } from "./SubmoduleDiff";

interface DiffBodyProps {
  shown: ShownDiff;
  file: DiffFile;
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
 * The diff of one file: changed by a commit, or in the working tree. Changing the options or the
 * layout keeps the old diff under an overlay until the new one is ready, then opens it at the
 * same line.
 */
interface FileDiffViewProps {
  repoId: number;
  file: DiffFile;
  /**
   * Lines of a working tree diff can be chosen and staged, unstaged or discarded (with hunk
   * buttons); unset for commits.
   */
  staging?: WorkingTreeKind | undefined;
}

export function FileDiffView({ repoId, file, staging: stagingKind }: FileDiffViewProps) {
  const [settings] = useDiffSettings();
  const lines = useLineStaging(repoId, file, stagingKind);
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
    worktree: file.worktree ?? false,
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
    body = <SubmoduleDiff repoId={repoId} file={file} />;
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
  const textDiff = shown?.diff.content === "text" && shown.diff.rows > 0;
  return (
    <LineStagingContext.Provider value={textDiff ? lines.staging : null}>
      <div className="flex h-full flex-col">
        <DiffHeader repoId={repoId} file={file} diff={summary.data ?? shown?.diff} />
        <LineSelectionBar />
        {body}
      </div>
      <ConfirmDialog
        open={lines.pending !== null}
        onOpenChange={(open) => {
          if (!open) lines.cancelDiscard();
        }}
        title={`Discard ${lines.pending?.what ?? ""} in ${file.path}?`}
        description="The changes go back to the staged version: added lines are removed, removed lines come back. NoBlame keeps no copy, so this cannot be undone."
        confirmLabel="Discard"
        destructive
        onConfirm={lines.confirmDiscard}
      />
    </LineStagingContext.Provider>
  );
}
