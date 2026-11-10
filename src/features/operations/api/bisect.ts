/**
 * Bisecting: where it stands (for the bar) and marking commits. The state is keyed under the
 * status, which the file watcher reads again on every change, so marks made in a terminal show
 * too; a mark reads the status again at once.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { statusKeys } from "@/features/working-tree";
import type { BisectMarkDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

export const bisectKeys = {
  state: (repoId: number) => [...statusKeys.all(repoId), "bisect"] as const,
};

/** Where the bisect stands; `null` when none runs. Read only while one runs. */
export function useBisectState(repoId: number, enabled: boolean) {
  return useQuery({
    queryKey: bisectKeys.state(repoId),
    queryFn: () => unwrap(commands.getBisect(repoId)),
    enabled,
  });
}

/** A mark: `commit` (`null`: the one checked out) as good, bad or skipped. */
export interface BisectMarkRequest {
  mark: BisectMarkDto;
  commit: string | null;
}

/** Marks a commit, starting a bisect when none runs. Callers show errors. */
export function useBisectMark(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mark, commit }: BisectMarkRequest) =>
      unwrap(commands.bisectMark(repoId, mark, commit)),
    meta: { silent: true, activity: "Bisecting" },
    onSettled: () => queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) }),
  });
}
