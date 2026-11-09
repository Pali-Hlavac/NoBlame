/**
 * The built-in merge view: a conflicted file merged line by line (read again whenever the status
 * changes, so a file resolved elsewhere shows as such), and saving the result.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { statusKeys, useWorkingTreeStatus } from "@/features/working-tree";
import type { SaveMergedRequestDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { forgetDecisions } from "../store/mergeView";

/** The conflicted `path` of repository `repoId` merged line by line, or why it cannot be. */
export function useMergeFile(repoId: number, path: string) {
  const status = useWorkingTreeStatus(repoId);
  return useQuery({
    queryKey: ["operations", repoId, "mergeFile", path, status.dataUpdatedAt],
    queryFn: () => unwrap(commands.getMergeFile(repoId, path)),
    // Keep showing the file while it is read again, but never another file.
    placeholderData: (previous, query) => (query?.queryKey[3] === path ? previous : undefined),
  });
}

/** Saves the merged file: staged in place of the conflict and written to the working tree. */
export function useSaveMerged(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SaveMergedRequestDto) => unwrap(commands.saveMergedFile(repoId, request)),
    meta: { silent: true, activity: "Saving the merged file" },
    onSuccess: (_, request) => {
      forgetDecisions(repoId, request.path);
      toast.success(`Saved ${request.path}`, {
        description: "Its conflict is resolved and the file is staged.",
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) }),
  });
}
