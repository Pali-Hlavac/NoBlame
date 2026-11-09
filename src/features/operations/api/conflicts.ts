/**
 * The conflicted files, resolving them by taking a side or marking them resolved, and the
 * external merge tool. The list is read again whenever the status changes (the file watcher
 * reports what a merge tool or a terminal did).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { statusKeys, useWorkingTreeStatus } from "@/features/working-tree";
import type { SideDto } from "@/shared/ipc/bindings";
import { commands, toIpcError, unwrap } from "@/shared/ipc/client";

/** The conflicted files of repository `repoId`, with which sides have them. */
export function useConflicts(repoId: number) {
  const status = useWorkingTreeStatus(repoId);
  return useQuery({
    // A new status means the conflicts may have changed too.
    queryKey: ["operations", repoId, "conflicts", status.dataUpdatedAt],
    queryFn: () => unwrap(commands.getConflicts(repoId)),
    placeholderData: (previous) => previous,
  });
}

/** Resolves files with one side's whole version, or marks them resolved as they are (stages). */
export function useResolve(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paths, side }: { paths: string[]; side: SideDto | "asIs" }) =>
      side === "asIs"
        ? unwrap(commands.stageFiles(repoId, paths))
        : unwrap(commands.takeConflictSide(repoId, paths, side)),
    meta: { silent: true, activity: "Resolving conflicts" },
    onSettled: () => queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) }),
  });
}

/** Opens a conflicted file in the merge tool from Settings; a toast says how it went. */
export function useOpenMergeTool(repoId: number) {
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: (path: string) => unwrap(commands.openMergeTool(repoId, path)),
    meta: { silent: true, activity: "Opening the merge tool" },
    onSuccess: (outcome, path) => {
      if (outcome === "opened") {
        toast.info(`Opened ${path} in the merge tool`, {
          description: "Resolve it there and save; closing the tool stages the file.",
        });
      } else if (outcome === "resolved") {
        toast.success(`Resolved ${path}`);
      } else {
        toast.info(`${path} still conflicts`, {
          description: "The merge tool was closed without resolving it.",
        });
      }
      void queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) });
    },
    onError: (error) => {
      const { message, hint } = toIpcError(error);
      toast.error("Could not open the merge tool", {
        description: hint ? `${message}\n\n${hint}` : message,
        classNames: { description: "whitespace-pre-line" },
      });
    },
  });
  return mutate;
}
