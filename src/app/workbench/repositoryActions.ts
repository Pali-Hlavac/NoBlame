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
import { toast } from "sonner";

import { openRepositories, type RepositoryAction } from "@/features/repositories";
import { useTabsStore } from "@/features/workspace";

import { COMMIT_MILESTONE, REMOTE_MILESTONE } from "./milestones";

/** Pulling, fetching and pushing are about branches and remotes. */
const BRANCHES = "branches";

export const REPOSITORY_ACTIONS: readonly RepositoryAction[] = [
  {
    id: "pull",
    label: "Pull",
    icon: ArrowDownToLineIcon,
    kind: BRANCHES,
    milestone: REMOTE_MILESTONE,
  },
  { id: "fetch", label: "Fetch", icon: RefreshCwIcon, kind: BRANCHES, milestone: REMOTE_MILESTONE },
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
    milestone: COMMIT_MILESTONE,
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
