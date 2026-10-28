/** Actions in the "…" menu of each open repository in the Repositories module. */
import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  CopyIcon,
  GitCommitVerticalIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { RepositoryAction } from "@/features/repositories";
import { useTabsStore } from "@/features/workspace";

import { COMMIT_MILESTONE, REMOTE_MILESTONE } from "./milestones";

export const REPOSITORY_ACTIONS: readonly RepositoryAction[] = [
  { id: "pull", label: "Pull", icon: ArrowDownToLineIcon, milestone: REMOTE_MILESTONE },
  { id: "fetch", label: "Fetch", icon: RefreshCwIcon, milestone: REMOTE_MILESTONE },
  { id: "push", label: "Push", icon: ArrowUpFromLineIcon, milestone: REMOTE_MILESTONE },
  { id: "commit", label: "Commit…", icon: GitCommitVerticalIcon, milestone: COMMIT_MILESTONE },
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
    id: "close",
    label: "Close",
    icon: XIcon,
    run: ({ tabId }) => {
      useTabsStore.getState().closeTab(tabId);
    },
  },
];
