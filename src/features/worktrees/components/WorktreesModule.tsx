import { EraserIcon, FoldersIcon, LockIcon, PlusIcon, RefreshCwIcon } from "lucide-react";

import { WithActiveRepository, openRepositories } from "@/features/repositories";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import type { WorktreeDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

import { useWorktrees } from "../api/worktrees";
import { canOpen, checkedOut, folderName } from "../lib/worktrees";
import { useWorktreeDialog } from "../store/dialog";
import { WorktreeDialogs } from "./WorktreeDialogs";
import { WorktreeMenu } from "./WorktreeMenu";

function Badge({ children, title }: { children: string; title?: string }) {
  return (
    <span
      title={title}
      className="shrink-0 rounded border border-border px-1 text-[0.7rem] text-muted-foreground"
    >
      {children}
    </span>
  );
}

function WorktreeRow({ repoId, worktree }: { repoId: number; worktree: WorktreeDto }) {
  const name = folderName(worktree.path);
  const openable = canOpen(worktree);
  return (
    <li>
      <WorktreeMenu repoId={repoId} worktree={worktree}>
        <button
          type="button"
          className={cn(
            "flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
            worktree.current && "bg-accent text-accent-foreground",
            !openable && "text-muted-foreground",
          )}
          title={worktree.prunable ?? worktree.path}
          aria-disabled={!openable}
          onClick={() => {
            if (openable) openRepositories([worktree.path]);
          }}
        >
          <span className="flex w-full min-w-0 items-center gap-1.5">
            <span className={cn("truncate text-sm", worktree.current && "font-medium")}>
              {name}
            </span>
            {worktree.main && <Badge>main worktree</Badge>}
            {worktree.current && <Badge>this tab</Badge>}
            {worktree.locked !== null && (
              <span title={worktree.locked || "Locked"} className="shrink-0">
                <LockIcon className="size-3.5" aria-label="locked" />
              </span>
            )}
            {worktree.prunable !== null && <Badge title={worktree.prunable}>folder gone</Badge>}
          </span>
          <span className="w-full truncate text-xs text-muted-foreground">
            {checkedOut(worktree)} · {worktree.path}
          </span>
        </button>
      </WorktreeMenu>
    </li>
  );
}

function ToolbarButton(props: {
  label: string;
  icon: typeof PlusIcon;
  disabled?: boolean;
  onClick: () => void;
}) {
  const Icon = props.icon;
  return (
    <Tooltip content={props.label}>
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        aria-label={props.label.replace("…", "")}
        disabled={props.disabled}
        onClick={props.onClick}
      >
        <Icon aria-hidden />
      </Button>
    </Tooltip>
  );
}

/** The worktrees of a repository: open one in a tab, add, lock, remove and prune them. */
export function Worktrees({ repoId }: { repoId: number }) {
  const worktrees = useWorktrees(repoId);
  const open = useWorktreeDialog((state) => state.open);
  const list = worktrees.data ?? [];
  const prunable = list.filter((worktree) => worktree.prunable !== null);
  let body;
  if (worktrees.error) {
    body = (
      <ErrorState
        error={worktrees.error}
        title="Could not list the worktrees"
        onRetry={() => void worktrees.refetch()}
        className="flex-1 justify-center"
      />
    );
  } else if (!worktrees.data) {
    body = <LoadingState label="Reading the worktrees…" className="flex-1" />;
  } else {
    body = (
      <div className="min-h-0 flex-1 overflow-auto p-1">
        <ul aria-label="Worktrees" className="space-y-0.5">
          {list.map((worktree) => (
            <WorktreeRow key={worktree.path} repoId={repoId} worktree={worktree} />
          ))}
        </ul>
        {list.length === 1 && (
          <EmptyState
            icon={FoldersIcon}
            title="Only the main worktree"
            description="A worktree checks out another branch in a folder of its own, sharing this repository's history. Add one to work on two branches at once."
          />
        )}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-end gap-1 border-b border-border px-2 py-1">
        <ToolbarButton
          label="Add a worktree…"
          icon={PlusIcon}
          disabled={!worktrees.data}
          onClick={() => {
            open({ kind: "add" });
          }}
        />
        <ToolbarButton
          label="Prune worktrees whose folders are gone…"
          icon={EraserIcon}
          disabled={prunable.length === 0}
          onClick={() => {
            open({ kind: "prune", prunable });
          }}
        />
        <ToolbarButton
          label="Refresh the worktrees"
          icon={RefreshCwIcon}
          disabled={worktrees.isFetching}
          onClick={() => void worktrees.refetch()}
        />
      </div>
      {body}
      <WorktreeDialogs repoId={repoId} worktrees={list} />
    </div>
  );
}

/** Worktrees module: the active repository's worktrees. */
export function WorktreesModule() {
  return (
    <WithActiveRepository>{(summary) => <Worktrees repoId={summary.id} />}</WithActiveRepository>
  );
}
