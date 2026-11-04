/** Opening the commit window: the Commit module, in the dock or in its popup when popped out. */
import { GitCommitVerticalIcon } from "lucide-react";

import type { PaletteCommand } from "@/features/command-palette";
import { useActiveRepository } from "@/features/repositories";
import { openModuleById } from "@/features/workbench";

/** Id of the Commit module (saved in layouts; never change it). */
export const COMMIT_MODULE_ID = "commit";

/** Opens the Commit module for the active repository. */
export function openCommit(): void {
  openModuleById(COMMIT_MODULE_ID);
}

/** The palette's Commit command, while a repository is active. */
export function useCommitCommands(): PaletteCommand[] {
  const active = useActiveRepository();
  if (!active.tab) return [];
  return [
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
}
