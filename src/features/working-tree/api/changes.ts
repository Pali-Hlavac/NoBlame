/** Changing the working tree from the diff: some lines of a file, or whole files thrown away. */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { LineChangeDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { statusKeys } from "./status";

/** Stage or discard lines of a working tree change, or unstage lines of a staged one. */
export type LineAction = "stage" | "unstage" | "discard";

function runLineChange(repoId: number, action: LineAction, request: LineChangeDto) {
  switch (action) {
    case "stage":
      return unwrap(commands.stageLines(repoId, request));
    case "unstage":
      return unwrap(commands.unstageLines(repoId, request));
    case "discard":
      return unwrap(commands.discardLines(repoId, request));
  }
}

/**
 * Stages, unstages or discards some changed lines of one file. The status (and with it the
 * file's ids, so the diff) is read again afterwards.
 */
export function useLineChange(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ action, request }: { action: LineAction; request: LineChangeDto }) =>
      runLineChange(repoId, action, request),
    meta: { activity: "Changing lines" },
    onSettled: () => queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) }),
  });
}

/** Files to throw away: changes to tracked files, and new files to delete. */
export interface DiscardedFiles {
  tracked: readonly string[];
  untracked: readonly string[];
}

/** Throws away working tree changes of whole files (callers confirm first). */
export function useDiscardFiles(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tracked, untracked }: DiscardedFiles) =>
      unwrap(commands.discardFiles(repoId, [...tracked], [...untracked])),
    meta: { activity: "Discarding changes" },
    onSettled: () => queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) }),
  });
}
