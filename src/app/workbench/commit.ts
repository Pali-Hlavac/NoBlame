/** Opening the commit window where Settings say: the Commit module, or the commit dialog. */
import { GitCommitVerticalIcon } from "lucide-react";

import type { PaletteCommand } from "@/features/command-palette";
import { openCommitDialog } from "@/features/commit";
import { useActiveRepository } from "@/features/repositories";
import { useAppSettings } from "@/features/settings";
import { openModuleById } from "@/features/workbench";
import type { CommitPlacement } from "@/shared/ipc/bindings";

/** Id of the Commit module (saved in layouts; never change it). */
export const COMMIT_MODULE_ID = "commit";

/** Opens the commit window for the active repository. */
export function openCommit(placement: CommitPlacement): void {
  if (placement === "dialog") openCommitDialog();
  else openModuleById(COMMIT_MODULE_ID);
}

/** Where the commit window opens (Settings → Committing). */
export function useCommitPlacement(): CommitPlacement {
  return useAppSettings().commit.openIn;
}

/** The palette's Commit command, while a repository is active. */
export function useCommitCommands(): PaletteCommand[] {
  const placement = useCommitPlacement();
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
      run: () => {
        openCommit(placement);
      },
    },
  ];
}
