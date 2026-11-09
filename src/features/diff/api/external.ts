/** Opening a file's diff in the external diff tool chosen in Settings. */
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { commands, toIpcError, unwrap } from "@/shared/ipc/client";

import type { DiffFile } from "../lib/diffFile";

/** Opens `file`'s two versions in the external diff tool; a failure is shown as a toast. */
export function useOpenExternalDiff(repoId: number) {
  return useMutation({
    mutationFn: (file: DiffFile) =>
      unwrap(
        commands.openExternalDiff(repoId, {
          oldId: file.oldId,
          newId: file.newId,
          path: file.path,
          oldPath: file.previousPath,
          worktree: file.worktree ?? false,
        }),
      ),
    meta: { activity: "Opening the diff tool" },
    onError: (error) => {
      const { message, hint } = toIpcError(error);
      toast.error("Could not open the diff tool", {
        description: hint ? `${message} ${hint}` : message,
      });
    },
  });
}
