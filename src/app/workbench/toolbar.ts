/** The toolbar's actions for the active repository, left to right (shown in the title bar). */
import { ArchiveIcon, ArrowDownToLineIcon, GitCommitVerticalIcon } from "lucide-react";
import { useMemo } from "react";

import { openModule, type ToolbarAction } from "@/features/workbench";

import { openCommit } from "./commit";
import {
  FETCHES,
  PULLS,
  PUSH_ICON,
  REMOTES_ICON,
  useRemoteActions,
  type RemoteActions,
} from "./remote";
import { MODULES } from "./modules";

const STASHES_MODULE = MODULES.find((module) => module.id === "stashes");

/**
 * The toolbar's actions; the Commit button opens the Commit module (or its popup). Pull, Push
 * and their menus use `remote` (no repository open, or no branch checked out: disabled).
 */
export function toolbarActions(remote: RemoteActions | undefined): readonly ToolbarAction[] {
  const onBranch = remote?.branch !== undefined ? remote : undefined;
  return [
    {
      id: "pull",
      label: "Pull",
      icon: ArrowDownToLineIcon,
      kind: "branches",
      run:
        onBranch &&
        (() => {
          onBranch.pull("default");
        }),
      menu: [
        ...PULLS.map((pull): ToolbarAction => ({
          id: pull.id,
          label: pull.label,
          icon: pull.icon,
          run:
            onBranch &&
            (() => {
              onBranch.pull(pull.value);
            }),
        })),
        ...FETCHES.map((fetch): ToolbarAction => ({
          id: fetch.id,
          label: fetch.label,
          icon: fetch.icon,
          run:
            remote &&
            (() => {
              remote.fetch(fetch.value);
            }),
        })),
        { id: "remotes", label: "Remotes…", icon: REMOTES_ICON, run: remote?.manageRemotes },
      ],
    },
    {
      id: "push",
      label: "Push",
      icon: PUSH_ICON,
      kind: "branches",
      run: onBranch?.push,
      menu: [
        { id: "push", label: "Push", icon: PUSH_ICON, run: onBranch?.push },
        { id: "push-options", label: "Push…", icon: PUSH_ICON, run: onBranch?.pushWithOptions },
      ],
    },
    ...OTHER_ACTIONS,
  ];
}

/** The toolbar's actions for the active repository. */
export function useToolbarActions(): readonly ToolbarAction[] {
  const remote = useRemoteActions();
  return useMemo(() => toolbarActions(remote), [remote]);
}

const OTHER_ACTIONS: readonly ToolbarAction[] = [
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
