/** The toolbar's actions for the active repository, left to right (shown in the title bar). */
import {
  ArchiveIcon,
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  GitCommitVerticalIcon,
} from "lucide-react";
import { useMemo } from "react";

import { openModule, type ToolbarAction } from "@/features/workbench";

import { openCommit } from "./commit";
import { FETCHES, useStartFetch, type StartFetch } from "./fetch";
import { REMOTE_MILESTONE } from "./milestones";
import { MODULES } from "./modules";

const STASHES_MODULE = MODULES.find((module) => module.id === "stashes");

/**
 * The toolbar's actions; the Commit button opens the Commit module (or its popup). The Pull
 * button's menu fetches with `startFetch` (no repository open: disabled).
 */
export function toolbarActions(startFetch: StartFetch | undefined): readonly ToolbarAction[] {
  return [
    {
      id: "pull",
      label: "Pull",
      icon: ArrowDownToLineIcon,
      kind: "branches",
      milestone: REMOTE_MILESTONE,
      menu: [
        { id: "pull", label: "Pull", icon: ArrowDownToLineIcon, milestone: REMOTE_MILESTONE },
        ...FETCHES.map((fetch): ToolbarAction => ({
          id: fetch.id,
          label: fetch.label,
          icon: fetch.icon,
          run: startFetch
            ? () => {
                startFetch(fetch.target, fetch.prune);
              }
            : undefined,
        })),
      ],
    },
    ...OTHER_ACTIONS,
  ];
}

/** The toolbar's actions for the active repository. */
export function useToolbarActions(): readonly ToolbarAction[] {
  const startFetch = useStartFetch();
  return useMemo(() => toolbarActions(startFetch), [startFetch]);
}

const OTHER_ACTIONS: readonly ToolbarAction[] = [
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
