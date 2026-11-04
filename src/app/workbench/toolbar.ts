/** The toolbar's actions for the active repository, left to right (shown in the title bar). */
import {
  ArchiveIcon,
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  GitCommitVerticalIcon,
  RefreshCwIcon,
  ScissorsIcon,
} from "lucide-react";
import { openModule, type ToolbarAction } from "@/features/workbench";
import { openCommit } from "./commit";
import { REMOTE_MILESTONE } from "./milestones";
import { MODULES } from "./modules";

const STASHES_MODULE = MODULES.find((module) => module.id === "stashes");

/** The toolbar's actions; the Commit button opens the Commit module (or its popup). */
export const TOOLBAR_ACTIONS: readonly ToolbarAction[] = [
  {
    id: "pull",
    label: "Pull",
    icon: ArrowDownToLineIcon,
    kind: "branches",
    milestone: REMOTE_MILESTONE,
    menu: [
      { id: "pull", label: "Pull", icon: ArrowDownToLineIcon, milestone: REMOTE_MILESTONE },
      { id: "fetch", label: "Fetch", icon: RefreshCwIcon, milestone: REMOTE_MILESTONE },
      {
        id: "fetch-all",
        label: "Fetch all remotes",
        icon: RefreshCwIcon,
        milestone: REMOTE_MILESTONE,
      },
      {
        id: "fetch-prune",
        label: "Fetch and prune",
        icon: ScissorsIcon,
        milestone: REMOTE_MILESTONE,
      },
    ],
  },
  {
    id: "push",
    label: "Push",
    icon: ArrowUpFromLineIcon,
    kind: "branches",
    milestone: REMOTE_MILESTONE,
  },
  {
    id: "commit",
    label: "Commit",
    icon: GitCommitVerticalIcon,
    kind: "commit",
    run: () => {
      openCommit();
    },
  },
  {
    id: "stashes",
    label: "Stashes",
    icon: ArchiveIcon,
    kind: "stash",
    run: STASHES_MODULE
      ? () => {
          openModule(STASHES_MODULE);
        }
      : undefined,
  },
];
