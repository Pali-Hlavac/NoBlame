import { ExternalLinkIcon, GitBranchIcon, GitCommitHorizontalIcon } from "lucide-react";

import { TASKS, TASK_WINDOWS_MILESTONE, useOpenTaskWindow } from "@/features/windows";
import type { RepoSummary, TaskKind } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

/** Task windows offered from the header (placeholders until M8). */
const HEADER_TASKS: readonly TaskKind[] = ["log", "commit", "fileHistory"];

const KIND_BADGES: Partial<Record<RepoSummary["kind"], string>> = {
  bare: "Bare",
  linkedWorktree: "Worktree",
  submodule: "Submodule",
};

function headLabel(head: RepoSummary["head"]): string {
  switch (head.kind) {
    case "branch":
      return head.name;
    case "unborn":
      return `${head.name} (no commits yet)`;
    case "detached":
      return `detached at ${head.id.slice(0, 8)}`;
  }
}

/** Name, path, HEAD and properties of the repository, plus task window buttons. */
export function RepositoryHeader({ summary }: { summary: RepoSummary }) {
  const openTaskWindow = useOpenTaskWindow();
  const badges = [
    KIND_BADGES[summary.kind],
    summary.isShallow ? "Shallow clone" : undefined,
  ].filter(Boolean);
  const HeadIcon = summary.head.kind === "detached" ? GitCommitHorizontalIcon : GitBranchIcon;
  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-border px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate font-semibold">{summary.name}</h1>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
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
        </div>
        <p className="truncate text-xs text-muted-foreground select-text">{summary.path}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {HEADER_TASKS.map((task) => (
          <Tooltip
            key={task}
            content={`Open a ${TASKS[task].title} window (placeholder until ${TASK_WINDOWS_MILESTONE})`}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                openTaskWindow.mutate({ task, path: summary.path });
              }}
            >
              <ExternalLinkIcon aria-hidden />
              {TASKS[task].title}
            </Button>
          </Tooltip>
        ))}
      </div>
    </header>
  );
}
