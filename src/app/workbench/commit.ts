/** Opening the commit window: the Commit module, in the dock or in its popup when popped out. */
import { ArchiveIcon, FileUpIcon, GitCommitVerticalIcon } from "lucide-react";

import type { PaletteCommand } from "@/features/command-palette";
import { openApplyPatches } from "@/features/patches";
import { useActiveRepository } from "@/features/repositories";
import { openStashChanges } from "@/features/stashes";
import { openModuleById } from "@/features/workbench";

/** Id of the Commit module (saved in layouts; never change it). */
export const COMMIT_MODULE_ID = "commit";

/** Opens the Commit module for the active repository. */
export function openCommit(): void {
  openModuleById(COMMIT_MODULE_ID);
}

/** Icon of Apply patches… (palette and the Commit button's menu). */
export const APPLY_PATCHES_ICON = FileUpIcon;

/** The palette's Commit, Stash changes and Apply patches commands, while a repository is active. */
export function useCommitCommands(): PaletteCommand[] {
  const active = useActiveRepository();
  if (!active.tab) return [];
  const commands: PaletteCommand[] = [
    {
      id: "commit.open",
      group: "Repository",
      label: "Commit…",
      icon: GitCommitVerticalIcon,
      kind: "commit",
      keywords: ["stage", "amend", "message", "index"],
      run: openCommit,
    },
  ];
  const repoId = active.summary?.id;
  if (repoId !== undefined) {
    commands.push({
      id: "stash.push",
      group: "Repository",
      label: "Stash changes…",
      icon: ArchiveIcon,
      kind: "stash",
      keybinding: "stash.push",
      keywords: ["stash", "save", "shelve", "put away"],
      run: () => {
        openStashChanges(repoId);
      },
    });
    commands.push({
      id: "patches.apply",
      group: "Repository",
      label: "Apply patches…",
      icon: APPLY_PATCHES_ICON,
      kind: "commit",
      keywords: ["patch", "am", "mailbox", "diff", "format-patch"],
      run: () => {
        openApplyPatches(repoId);
      },
    });
  }
  return commands;
}
