/** Repository groups: read once, edited optimistically, saved one after another. */
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

import type { RepositoryGroup, RepositoryGroupsDto } from "@/shared/ipc/bindings";
import { commands, toIpcError, unwrap } from "@/shared/ipc/client";

export const groupKeys = { all: ["repository-groups"] as const };

export function useRepositoryGroups() {
  return useQuery({
    queryKey: groupKeys.all,
    queryFn: () => unwrap(commands.getRepositoryGroups()),
  });
}

/** An edit of the whole list (see `lib/groups.ts`). */
export type GroupsEdit = (groups: readonly RepositoryGroup[]) => RepositoryGroup[];

/** Saves in the order the edits were made: each save carries every earlier edit. */
let saving: Promise<void> = Promise.resolve();
/** The list last sent; an older save's answer must not overwrite a newer edit. */
let latest: readonly RepositoryGroup[] | null = null;

function save(queryClient: QueryClient, groups: RepositoryGroup[]): void {
  latest = groups;
  saving = saving.then(
    () =>
      unwrap(commands.saveRepositoryGroups(groups)).then(
        (saved: RepositoryGroupsDto) => {
          if (latest === groups) queryClient.setQueryData(groupKeys.all, saved);
        },
        (error: unknown) => {
          toast.error("Could not save the repository groups", {
            description: toIpcError(error).message,
          });
          void queryClient.invalidateQueries({ queryKey: groupKeys.all });
        },
      ),
    () => undefined,
  );
}

/** Applies an edit to the shown groups at once and saves the result. */
export function useEditGroups(): (edit: GroupsEdit) => void {
  const queryClient = useQueryClient();
  return useCallback(
    (edit: GroupsEdit) => {
      const current = queryClient.getQueryData<RepositoryGroupsDto>(groupKeys.all);
      if (!current) return;
      const groups = edit(current.groups);
      queryClient.setQueryData<RepositoryGroupsDto>(groupKeys.all, { ...current, groups });
      save(queryClient, groups);
    },
    [queryClient],
  );
}
