import {
  FileQuestionIcon,
  FileUserIcon,
  FolderIcon,
  HistoryIcon,
  MousePointerClickIcon,
  PackageIcon,
  SaveIcon,
} from "lucide-react";
import { useEffect } from "react";

import { showBlame } from "@/features/blame";
import { useCommitDetails } from "@/features/commit-details";
import { saveFileAs } from "@/features/file-menu";
import { FileContents } from "@/features/diff";
import { shortId } from "@/features/graph";
import { showHistory } from "@/features/history";
import { WithActiveRepository } from "@/features/repositories";
import { useSelection } from "@/features/selection";
import { FILE_TAB, useTabsStore } from "@/features/workspace";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import type { TreeEntryDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { useTreeEntry } from "../api/tree";
import { parentPath } from "../lib/rows";
import { useChosenFile } from "../store/files";

/** "File: main.rs", or "File" when none is chosen. */
function fileTabTitle(path: string | undefined): string {
  return path ? `File: ${path.slice(path.lastIndexOf("/") + 1)}` : "File";
}

interface EntryBodyProps {
  repoId: number;
  entry: TreeEntryDto;
  path: string;
  commit: string;
}

function EntryBody({ repoId, entry, path, commit }: EntryBodyProps) {
  switch (entry.kind) {
    case "folder":
      return (
        <EmptyState
          icon={FolderIcon}
          title="A folder"
          description={`${path} is a folder at ${commit}. Open it in Files.`}
          className="flex-1"
        />
      );
    case "submodule":
      return (
        <EmptyState
          icon={PackageIcon}
          title="Submodule"
          description={`At ${commit}, it points at commit ${shortId(entry.id)} of another repository.`}
          className="flex-1"
        />
      );
    default:
      return (
        <FileContents
          repoId={repoId}
          blobId={entry.id}
          path={path}
          label={`${path} at ${commit}`}
        />
      );
  }
}

interface ChosenFileProps {
  repoId: number;
  repoPath: string;
  row: number;
  path: string;
}

/** The chosen path at the selected commit: its contents, or why there are none. */
function ChosenFile({ repoId, repoPath, row, path }: ChosenFileProps) {
  const entry = useTreeEntry(repoId, row, path);
  const details = useCommitDetails(repoId, row);
  const commit = details.data ? shortId(details.data.id) : "this commit";
  const name = path.slice(path.lastIndexOf("/") + 1);
  const saveable = entry.data && entry.data.kind !== "folder" && entry.data.kind !== "submodule";
  let body;
  if (entry.error) {
    body = (
      <ErrorState
        error={entry.error}
        title="Could not read the file"
        onRetry={() => void entry.refetch()}
        className="flex-1 justify-center"
      />
    );
  } else if (entry.data === undefined) {
    body = <LoadingState label="Reading the file…" className="flex-1" />;
  } else if (entry.data === null) {
    body = (
      <EmptyState
        icon={FileQuestionIcon}
        title="Not in this commit"
        description={`${path} does not exist at ${commit}. Choose a file in Files.`}
        className="flex-1"
      />
    );
  } else {
    body = <EntryBody repoId={repoId} entry={entry.data} path={path} commit={commit} />;
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-1.5 text-sm">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="font-medium">{name}</span>
          <span className="min-w-0 truncate text-xs text-muted-foreground">{parentPath(path)}</span>
          <span className="text-xs text-muted-foreground">
            at <span className="font-mono">{commit}</span>
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-6 px-2 text-xs"
          onClick={() => {
            showHistory(repoPath, { path, folder: false });
          }}
        >
          <HistoryIcon aria-hidden />
          History
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs"
          disabled={!saveable || !details.data}
          onClick={() => {
            if (details.data) showBlame(repoPath, { commit: details.data.id, path });
          }}
        >
          <FileUserIcon aria-hidden />
          Blame
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs"
          disabled={!saveable}
          onClick={() => {
            if (entry.data) void saveFileAs(repoId, entry.data.id, name);
          }}
        >
          <SaveIcon aria-hidden />
          Save as…
        </Button>
      </div>
      {body}
    </div>
  );
}

function SelectedFile({ repoId, repoPath }: { repoId: number; repoPath: string }) {
  const selection = useSelection(repoPath);
  const path = useChosenFile(repoPath);

  useEffect(() => {
    useTabsStore.getState().setTitle(FILE_TAB.id, fileTabTitle(path));
  }, [path]);

  if (selection?.kind !== "commit" || path === undefined) {
    return (
      <EmptyState
        icon={MousePointerClickIcon}
        title="No file chosen"
        description="Select a commit, then a file in Files (Alt+6)."
        className="h-full"
      />
    );
  }
  return <ChosenFile repoId={repoId} repoPath={repoPath} row={selection.row} path={path} />;
}

/**
 * The file tab: the file chosen in Files, at the active repository's selected commit. There is
 * one; choosing another file (or commit) switches it in place.
 */
export function FileView() {
  return (
    <WithActiveRepository>
      {(summary, tab) => <SelectedFile repoId={summary.id} repoPath={tab.path} />}
    </WithActiveRepository>
  );
}
