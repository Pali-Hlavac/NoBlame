/**
 * Merging into the current branch and stepping the operation in progress. The file watcher
 * reports what changed (refs, index, files); the status is read again at once so the banner
 * and the conflict counts follow without waiting for it.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { statusKeys } from "@/features/working-tree";
import type { MergeRequestDto, SequenceStepDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

/** Merges a branch, tag or commit into the current branch. The dialog shows errors. */
export function useMerge(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: MergeRequestDto) => unwrap(commands.mergeIntoCurrent(repoId, request)),
    meta: { silent: true, activity: "Merging" },
    onSettled: () => queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) }),
  });
}

/** What the status bar says while a step runs. */
const STEP_ACTIVITY: Readonly<Record<SequenceStepDto, string>> = {
  continue: "Continuing",
  skip: "Skipping the commit",
  abort: "Aborting",
};

/** Continues, skips or aborts the operation in progress. The banner shows errors. */
export function useStepOperation(repoId: number, step: SequenceStepDto) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(commands.stepOperation(repoId, step)),
    meta: { silent: true, activity: STEP_ACTIVITY[step] },
    onSettled: () => queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) }),
  });
}
