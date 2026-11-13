import { ChevronsDownIcon, ChevronsUpIcon, FolderXIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { sortedByPath } from "@/features/changed-files";
import { select, selectFile, useSelectedFile, useSelection } from "@/features/selection";
import { useAppSettings } from "@/features/settings";
import {
  filesOf,
  totalOf,
  useDiscardFiles,
  useWorkingTreeStatus,
  type WorkingTreeKind,
} from "@/features/working-tree";
import { showDiffTab } from "@/features/workspace";
import type { WorkingFileDto } from "@/shared/ipc/bindings";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";

import { useIndexChange, type IndexChange } from "../api/commit";
import { discardPlan, type DiscardPlan } from "../lib/discard";
import { indexPaths, neighbour } from "../lib/files";
import { IgnoreDialog } from "./IgnoreDialog";
import { StagingList, type StagingVerb } from "./StagingList";

const STAGE: StagingVerb = {
  label: "Stage",
  working: "Staging…",
  icon: PlusIcon,
  allIcon: ChevronsDownIcon,
};
const UNSTAGE: StagingVerb = {
  label: "Unstage",
  working: "Unstaging…",
  icon: MinusIcon,
  allIcon: ChevronsUpIcon,
};

/** A change waiting for the user to confirm it. */
interface Pending {
  title: string;
  change: IndexChange;
}

const RESOLVED_WARNING =
  "Staging a conflicted file tells Git its conflict is resolved. Check that no conflict markers (<<<<<<<, >>>>>>>) are left in it.";

interface StagingListsProps {
  repoId: number;
  repoPath: string;
  /** Choosing a file shows the diff tab (docked); popped out, the module shows it itself. */
  showDiff: boolean;
}

/** The changed files above the staged ones; files move between them with a click or Space. */
export function StagingLists({ repoId, repoPath, showDiff }: StagingListsProps) {
  const status = useWorkingTreeStatus(repoId);
  const selection = useSelection(repoPath);
  const chosenPath = useSelectedFile(repoPath);
  const indexChange = useIndexChange(repoId);
  const [pending, setPending] = useState<Pending | null>(null);
  const discard = useDiscardFiles(repoId);
  const [discarding, setDiscarding] = useState<DiscardPlan | null>(null);
  const [ignoring, setIgnoring] = useState<string | null>(null);
  const pathFirst = useAppSettings().commit.fileDisplay === "pathFirst";
  const data = status.data ?? null;
  // Each list as it is shown: git's order, or sorted by the whole path with the folder first.
  const shown = useMemo(() => {
    const list = (kind: WorkingTreeKind) => {
      const files = data ? filesOf(data, kind) : [];
      return pathFirst ? sortedByPath(files) : files;
    };
    return { worktree: list("worktree"), index: list("index") };
  }, [data, pathFirst]);

  if (status.error) {
    return (
      <ErrorState
        error={status.error}
        title="Could not read the status"
        onRetry={() => void status.refetch()}
        className="flex-1 justify-center"
      />
    );
  }
  if (status.data === undefined) {
    return <LoadingState label="Reading the status…" className="flex-1" />;
  }
  if (data === null) {
    return (
      <EmptyState
        icon={FolderXIcon}
        title="No working tree"
        description="A bare repository has no files to commit."
        className="flex-1"
      />
    );
  }
  const choose = (kind: WorkingTreeKind, file: WorkingFileDto): void => {
    select(repoPath, { kind });
    selectFile(repoPath, file.path);
    if (showDiff) showDiffTab();
  };

  /** Keeps a diff on screen: the next file of the list, or the moved file in its new list. */
  const moveChoice = (kind: WorkingTreeKind, file: WorkingFileDto, index: number): void => {
    if (selection?.kind !== kind || chosenPath !== file.path) return;
    const next = neighbour(shown[kind], index);
    if (next) selectFile(repoPath, next.path);
    else select(repoPath, { kind: kind === "worktree" ? "index" : "worktree" });
  };

  const list = (kind: WorkingTreeKind) => {
    const stage = kind === "worktree";
    return (
      <StagingList
        repoId={repoId}
        repoPath={repoPath}
        title={stage ? "Changes" : "Staged"}
        files={shown[kind]}
        pathFirst={pathFirst}
        total={totalOf(data.summary, kind)}
        verb={stage ? STAGE : UNSTAGE}
        chosen={selection?.kind === kind ? chosenPath : undefined}
        busy={indexChange.isPending || discard.isPending}
        working={indexChange.isPending && indexChange.variables.stage === stage}
        empty={stage ? "No changes in the working tree." : "Nothing is staged."}
        onChoose={(file) => {
          choose(kind, file);
        }}
        onToggle={(file, index) => {
          const change = { stage, paths: indexPaths(file) };
          if (file.status === "conflicted") {
            setPending({ title: `Mark ${file.path} as resolved?`, change });
            return;
          }
          moveChoice(kind, file, index);
          indexChange.mutate(change);
        }}
        onToggleAll={() => {
          if (stage && data.summary.conflicted > 0) {
            const count = data.summary.conflicted;
            setPending({
              title: `Stage all, marking ${count} conflicted ${count === 1 ? "file" : "files"} as resolved?`,
              change: { stage },
            });
            return;
          }
          indexChange.mutate({ stage });
        }}
        onDiscard={
          stage
            ? (file) => {
                setDiscarding(discardPlan([file], { all: false, truncated: false }));
              }
            : undefined
        }
        onIgnore={
          stage
            ? (file) => {
                setIgnoring(file.path);
              }
            : undefined
        }
        onDiscardAll={
          stage
            ? () => {
                const files = shown[kind];
                const truncated = totalOf(data.summary, kind) > files.length;
                setDiscarding(discardPlan(files, { all: true, truncated }));
              }
            : undefined
        }
      />
    );
  };

  return (
    <>
      {list("worktree")}
      <div className="border-t border-border" />
      {list("index")}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending?.title ?? ""}
        description={RESOLVED_WARNING}
        confirmLabel="Stage"
        onConfirm={() => {
          if (pending) indexChange.mutate(pending.change);
          setPending(null);
        }}
      />
      {ignoring !== null && (
        <IgnoreDialog
          key={ignoring}
          repoId={repoId}
          path={ignoring}
          onClose={() => {
            setIgnoring(null);
          }}
        />
      )}
      <ConfirmDialog
        open={discarding !== null}
        onOpenChange={(open) => {
          if (!open) setDiscarding(null);
        }}
        title={discarding?.title ?? ""}
        description={discarding?.description ?? ""}
        confirmLabel={discarding?.files.tracked.length === 0 ? "Delete" : "Discard"}
        destructive
        onConfirm={() => {
          if (discarding) discard.mutate(discarding.files);
          setDiscarding(null);
        }}
      />
    </>
  );
}
