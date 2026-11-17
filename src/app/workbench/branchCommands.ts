/** The command palette's branch commands for the active repository. */
import { GitBranchPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { openBranchDialog } from "@/features/branches";
import type { PaletteCommand } from "@/features/command-palette";
import { type StartPoint, shortId } from "@/features/graph";
import { useActiveRepository } from "@/features/repositories";
import { useSelectionStore } from "@/features/selection";
import { commands, toIpcError, unwrap } from "@/shared/ipc/client";
import type { HeadDto } from "@/shared/ipc/bindings";

/** Where HEAD is, as a start point: the current branch's name, or the detached commit. */
function headStart(head: HeadDto): StartPoint {
  return head.kind === "detached"
    ? { revision: head.id, label: shortId(head.id) }
    : { revision: head.name, label: head.name };
}

/** The selected commit as a start point, read from the graph (its summary names it). */
async function commitStart(repoId: number, row: number): Promise<StartPoint> {
  const details = await unwrap(commands.getCommitDetails(repoId, row));
  const summary = details.message.split("\n", 1)[0] ?? "";
  return { revision: details.id, label: `${shortId(details.id)} ${summary}`.trim() };
}

/** **Create a branch…**: at the commit selected in the graph, or else where HEAD is. */
export function useBranchCommands(): PaletteCommand[] {
  const { tab, summary } = useActiveRepository();
  if (!tab || !summary || summary.head.kind === "unborn") return [];
  const repoId = summary.id;
  const head = summary.head;
  return [
    {
      id: "branch.create",
      group: "Branches",
      label: "Create a branch…",
      icon: GitBranchPlusIcon,
      kind: "branches",
      keybinding: "branch.create",
      keywords: ["new", "branch", "checkout", "switch"],
      run: () => {
        const selection = useSelectionStore.getState().selections[tab.path];
        const start =
          selection?.kind === "commit"
            ? commitStart(repoId, selection.row)
            : Promise.resolve(headStart(head));
        start
          .then((point) => {
            openBranchDialog({ kind: "create-branch", repoId, start: point });
          })
          .catch((error: unknown) => {
            toast.error("Could not read the selected commit", {
              description: toIpcError(error).message,
            });
          });
      },
    },
  ];
}
