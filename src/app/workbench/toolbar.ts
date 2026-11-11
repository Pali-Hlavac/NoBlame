/** The toolbar's actions for the active repository, left to right (shown in the title bar). */
import { ArchiveIcon, ArrowDownToLineIcon, GitCommitVerticalIcon } from "lucide-react";
import { useMemo } from "react";

import { openApplyPatches } from "@/features/patches";
import { useActiveRepository } from "@/features/repositories";
import { openModule, type ToolbarAction } from "@/features/workbench";

import { APPLY_PATCHES_ICON, openCommit } from "./commit";
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
 * The toolbar's actions; the Commit button opens the Commit module (or its popup), its menu also
 * Apply patches… for repository `repoId`. Pull, Push and their menus use `remote` (no
 * repository open, or no branch checked out: disabled).
 */
export function toolbarActions(
  remote: RemoteActions | undefined,
  repoId?: number,
): readonly ToolbarAction[] {
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
    commitAction(repoId),
    STASHES_ACTION,
  ];
}

/** The toolbar's actions for the active repository. */
export function useToolbarActions(): readonly ToolbarAction[] {
  const remote = useRemoteActions();
  const repoId = useActiveRepository().summary?.id;
  return useMemo(() => toolbarActions(remote, repoId), [remote, repoId]);
}

function commitAction(repoId: number | undefined): ToolbarAction {
  return {
    id: "commit",
    label: "Commit",
    icon: GitCommitVerticalIcon,
    kind: "commit",
    run: openCommit,
    menu: [
      { id: "commit", label: "Commit…", icon: GitCommitVerticalIcon, run: openCommit },
      {
        id: "apply-patches",
        label: "Apply patches…",
        icon: APPLY_PATCHES_ICON,
        run:
          repoId === undefined
            ? undefined
            : () => {
                openApplyPatches(repoId);
              },
      },
    ],
  };
}

const STASHES_ACTION: ToolbarAction = {
  id: "stashes",
  label: "Stashes",
  icon: ArchiveIcon,
  kind: "stash",
  run: STASHES_MODULE
    ? () => {
        openModule(STASHES_MODULE);
      }
    : undefined,
};
