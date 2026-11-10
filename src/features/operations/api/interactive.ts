/**
 * The interactive rebase: the commits it lists from a chosen commit up to HEAD, and running it
 * with the edited list. The status is read again afterwards, so the bar above the commits
 * follows a rebase that stopped.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { statusKeys } from "@/features/working-tree";
import type { InteractiveRequestDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

/** The commits from `from` (included) up to HEAD, oldest first. */
export function useInteractivePlan(repoId: number, from: string) {
  return useQuery({
    queryKey: ["operations", repoId, "interactive-plan", from],
    queryFn: () => unwrap(commands.getInteractivePlan(repoId, from)),
    // Always read again: the branch may have moved since the editor last opened.
    gcTime: 0,
    // The list is being edited: a refetch must not replace it underneath.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** Runs the interactive rebase. The dialog shows errors. */
export function useRebaseInteractive(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: InteractiveRequestDto) =>
      unwrap(commands.rebaseInteractive(repoId, request)),
    meta: { silent: true, activity: "Rebasing" },
    onSettled: () => queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) }),
  });
}
