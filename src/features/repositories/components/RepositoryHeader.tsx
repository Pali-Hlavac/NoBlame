import { ExternalLinkIcon, GitBranchIcon, GitCommitHorizontalIcon } from "lucide-react";

import { useAppSettings } from "@/features/settings";
import { TASKS, useOpenTaskWindow } from "@/features/windows";
import { WorkingTreeChip } from "@/features/working-tree";
import type { RepoSummary, TaskKind } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

import { headLabel } from "../lib/head";

/** Task windows offered from the header. */
const HEADER_TASKS: readonly TaskKind[] = ["log", "commit", "fileHistory"];

const KIND_BADGES: Partial<Record<RepoSummary["kind"], string>> = {
  bare: "Bare",
  linkedWorktree: "Worktree",
  submodule: "Submodule",
};

/** Name, path, HEAD and properties of the repository, plus task window buttons. */
export function RepositoryHeader({ summary }: { summary: RepoSummary }) {
  const openTaskWindow = useOpenTaskWindow();
  const chip = useAppSettings().graph.workingTree === "header" && summary.kind !== "bare";
  const badges = [
    KIND_BADGES[summary.kind],
    summary.isShallow ? "Shallow clone" : undefined,
  ].filter(Boolean);
  const HeadIcon = summary.head.kind === "detached" ? GitCommitHorizontalIcon : GitBranchIcon;
  return (
    <header className="@container flex shrink-0 items-center gap-4 border-b border-border px-3 py-2">
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate font-semibold">{summary.name}</h1>
          <span className="flex min-w-0 items-center gap-1 truncate text-sm text-muted-foreground">
            <HeadIcon className="size-3.5" aria-hidden />
            <span className="sr-only">HEAD:</span>
            {headLabel(summary.head)}
          </span>
          {badges.map((badge) => (
            <span
              key={badge}
              className="rounded border border-border px-1.5 text-xs text-muted-foreground"
            >
              {badge}
            </span>
          ))}
          {chip && <WorkingTreeChip repoId={summary.id} />}
        </div>
        <p className="truncate text-xs text-muted-foreground select-text">{summary.path}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {HEADER_TASKS.map((task) => (
          <Tooltip key={task} content={`Open a ${TASKS[task].title} window`}>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Open a ${TASKS[task].title} window`}
              onClick={() => {
                openTaskWindow.mutate({ task, path: summary.path });
              }}
            >
              <ExternalLinkIcon aria-hidden />
              <span className="hidden @2xl:inline">{TASKS[task].title}</span>
            </Button>
          </Tooltip>
        ))}
      </div>
    </header>
  );
}
