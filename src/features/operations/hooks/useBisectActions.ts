import { useCallback } from "react";
import { toast } from "sonner";

import type { StartPoint } from "@/features/graph";
import { useWorkingTreeStatus } from "@/features/working-tree";
import type { BisectMarkDto } from "@/shared/ipc/bindings";
import { toIpcError } from "@/shared/ipc/client";

import { useBisectMark } from "../api/bisect";
import { bisectToast } from "../lib/bisect";
import { showOutcome } from "../lib/outcome";
import { rememberCounts } from "../store/bisect";
import { openBisect } from "../store/dialog";

/**
 * Marks a commit (`null`: the one checked out) in repository `repoId`'s bisect. Without a bisect
 * running, the dialog explaining bisecting opens first; a skip then says to start with good and
 * bad. The toast tells what comes next.
 */
export function useBisectActions(
  repoId: number,
): (commit: StartPoint | null, mark: BisectMarkDto) => void {
  const bisecting = useWorkingTreeStatus(repoId).data?.operation?.kind === "bisect";
  const { mutate } = useBisectMark(repoId);
  return useCallback(
    (commit, mark) => {
      if (!bisecting) {
        if (mark === "skip") {
          toast.info("No bisect is running", {
            description: "Start one by marking a bad commit and a good one.",
          });
        } else if (commit) {
          openBisect(repoId, commit, mark);
        }
        return;
      }
      mutate(
        { mark, commit: commit?.revision ?? null },
        {
          onSuccess: (result) => {
            rememberCounts(repoId, result.outcome);
            showOutcome(bisectToast(mark, result.outcome));
          },
          onError: (error) => {
            const { message, hint } = toIpcError(error);
            toast.error("Git did not take the mark", {
              description: hint ? `${message}\n\n${hint}` : message,
              classNames: { description: "whitespace-pre-line" },
            });
          },
        },
      );
    },
    [bisecting, mutate, repoId],
  );
}
