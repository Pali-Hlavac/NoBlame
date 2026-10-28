import { GitBranchIcon, GitCommitHorizontalIcon } from "lucide-react";

import { useActiveRepository } from "../hooks/useActiveRepository";
import { headLabel } from "../lib/head";

/** The active repository and its current branch, for the toolbar. */
export function ActiveRepositoryStatus() {
  const { tab, summary } = useActiveRepository();
  if (!tab) return null;
  const HeadIcon = summary?.head.kind === "detached" ? GitCommitHorizontalIcon : GitBranchIcon;
  return (
    <p
      className="flex min-w-0 items-center gap-1.5 truncate px-1 text-sm"
      title={`Active repository: ${tab.path}`}
    >
      <span className="truncate font-medium">{tab.title}</span>
      {summary && (
        <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
          <HeadIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="sr-only">on</span>
          <span className="truncate">{headLabel(summary.head)}</span>
        </span>
      )}
    </p>
  );
}
