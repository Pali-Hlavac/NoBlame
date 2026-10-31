import { ArrowLeftIcon, FileQuestionIcon, PackageIcon } from "lucide-react";
import { useEffect, useMemo } from "react";

import { FileContents, type LineGutter } from "@/features/diff";
import { shortId } from "@/features/graph";
import { WithActiveRepository } from "@/features/repositories";
import { BLAME_TAB, useTabsStore } from "@/features/workspace";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import type { BlameDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { useBlame } from "../api/blame";
import { hunkAt, recency } from "../lib/hunks";
import { type BlameTarget, goBack, useBlameTarget, useCanGoBack } from "../store/blame";
import { BLAME_GUTTER_WIDTH, BlameCell } from "./BlameCell";

function splitPath(path: string): { name: string; folder: string } {
  const slash = path.lastIndexOf("/");
  return { name: path.slice(slash + 1), folder: slash < 0 ? "" : path.slice(0, slash) };
}

interface BlameProps {
  repoId: number;
  repoPath: string;
}

interface BlamedLinesProps extends BlameProps {
  target: BlameTarget;
  blame: BlameDto;
  blobId: string;
}

function BlamedLines({ repoId, repoPath, target, blame, blobId }: BlamedLinesProps) {
  const gutter = useMemo<LineGutter>(() => {
    const recent = recency(blame.commits);
    return {
      width: BLAME_GUTTER_WIDTH,
      render: (line) => {
        const hunk = hunkAt(blame.hunks, line);
        return (
          hunk && (
            <BlameCell
              repoId={repoId}
              repoPath={repoPath}
              blame={blame}
              hunk={hunk}
              line={line}
              recency={recent[hunk.commit] ?? 0}
            />
          )
        );
      },
    };
  }, [repoId, repoPath, blame]);
  return (
    <FileContents
      repoId={repoId}
      blobId={blobId}
      path={target.path}
      label={`Blame of ${target.path} at ${shortId(target.commit)}`}
      gutter={gutter}
    />
  );
}

function TargetBlame({ repoId, repoPath, target }: BlameProps & { target: BlameTarget }) {
  const blame = useBlame(repoId, target);
  const canGoBack = useCanGoBack(repoPath);
  const { name, folder } = splitPath(target.path);
  let body;
  if (blame.error) {
    body = (
      <ErrorState
        error={blame.error}
        title="Could not blame the file"
        onRetry={() => void blame.refetch()}
        className="flex-1 justify-center"
      />
    );
  } else if (!blame.data) {
    body = <LoadingState label="Finding who changed each line…" className="flex-1" />;
  } else if (blame.data.blobId === null) {
    body = (
      <EmptyState
        icon={PackageIcon}
        title="Not a file"
        description={`${target.path} is a submodule at ${shortId(target.commit)}.`}
        className="flex-1"
      />
    );
  } else {
    body = (
      <BlamedLines
        repoId={repoId}
        repoPath={repoPath}
        target={target}
        blame={blame.data}
        blobId={blame.data.blobId}
      />
    );
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-1.5 text-sm">
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs"
          disabled={!canGoBack}
          onClick={() => {
            goBack(repoPath);
          }}
        >
          <ArrowLeftIcon aria-hidden />
          Back
        </Button>
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="font-medium">{name}</span>
          <span className="min-w-0 truncate text-xs text-muted-foreground">{folder}</span>
          <span className="text-xs text-muted-foreground">
            at <span className="font-mono">{shortId(target.commit)}</span>
          </span>
        </div>
      </div>
      {body}
    </div>
  );
}

function ChosenBlame({ repoId, repoPath }: BlameProps) {
  const target = useBlameTarget(repoPath);

  useEffect(() => {
    const title = target ? `Blame: ${splitPath(target.path).name}` : "Blame";
    useTabsStore.getState().setTitle(BLAME_TAB.id, title);
  }, [target]);

  if (!target) {
    return (
      <EmptyState
        icon={FileQuestionIcon}
        title="No file chosen"
        description="Right-click a file in Files (Alt+6) and choose Blame, or click Blame in the File tab."
        className="h-full"
      />
    );
  }
  return (
    <TargetBlame
      key={`${target.commit}:${target.path}`}
      repoId={repoId}
      repoPath={repoPath}
      target={target}
    />
  );
}

/**
 * The blame tab: who last changed each line of a file at a commit. It stays on that version
 * (selecting another commit does not change it); "Blame the previous revision" moves to the
 * version before a change, and **Back** returns.
 */
export function BlameView() {
  return (
    <WithActiveRepository>
      {(summary, tab) => <ChosenBlame repoId={summary.id} repoPath={tab.path} />}
    </WithActiveRepository>
  );
}
