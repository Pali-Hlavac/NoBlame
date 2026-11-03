/** Actions in the "…" menu of the repositories in the Repositories module (open and grouped). */
import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  CopyIcon,
  FolderOpenIcon,
  GitCommitVerticalIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { openRepositories, type RepositoryAction } from "@/features/repositories";
import { useTabsStore } from "@/features/workspace";
import type { CommitPlacement } from "@/shared/ipc/bindings";

import { openCommit, useCommitPlacement } from "./commit";
import { REMOTE_MILESTONE } from "./milestones";

/** Pulling, fetching and pushing are about branches and remotes. */
const BRANCHES = "branches";

/** The actions; Commit… opens (or shows) the repository, then the commit window. */
function repositoryActions(placement: CommitPlacement): readonly RepositoryAction[] {
  return [
    {
      id: "pull",
      label: "Pull",
      icon: ArrowDownToLineIcon,
      kind: BRANCHES,
      milestone: REMOTE_MILESTONE,
    },
    {
      id: "fetch",
      label: "Fetch",
      icon: RefreshCwIcon,
      kind: BRANCHES,
      milestone: REMOTE_MILESTONE,
    },
    {
      id: "push",
      label: "Push",
      icon: ArrowUpFromLineIcon,
      kind: BRANCHES,
      milestone: REMOTE_MILESTONE,
    },
    {
      id: "commit",
      label: "Commit…",
      icon: GitCommitVerticalIcon,
      kind: "commit",
      run: ({ path, tabId, open }) => {
        if (open) useTabsStore.getState().activateTab(tabId);
        else openRepositories([path]);
        openCommit(placement);
      },
    },
    {
      id: "copy-path",
      label: "Copy path",
      icon: CopyIcon,
      group: "start",
      run: ({ path }) => {
        navigator.clipboard.writeText(path).then(
          () => toast.success("Path copied"),
          () => toast.error("Could not copy the path"),
        );
      },
    },
    {
      id: "open",
      label: "Open",
      icon: FolderOpenIcon,
      kind: "repositories",
      when: "closed",
      run: ({ path }) => {
        openRepositories([path]);
      },
    },
    {
      id: "close",
      label: "Close",
      icon: XIcon,
      when: "open",
      run: ({ tabId }) => {
        useTabsStore.getState().closeTab(tabId);
      },
    },
  ];
}

export function useRepositoryActions(): readonly RepositoryAction[] {
  const placement = useCommitPlacement();
  return useMemo(() => repositoryActions(placement), [placement]);
}
