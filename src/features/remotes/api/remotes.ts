/**
 * The remotes of an open repository with their URLs, and adding and removing them (the editor's
 * saving is in `remoteSettings.ts`).
 * The list lives under the refs' key: a change refetches it, the remote names the Push dialog
 * offers and the refs (renamed or removed remote branches).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { refKeys } from "@/features/graph";
import type { AddRemoteRequestDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

export const remoteDetailKeys = {
  list: (repoId: number) => [...refKeys.all(repoId), "remote-details"] as const,
};

/** Every remote with its URLs, remote branches and the branches tracking it; read afresh. */
export function useRemoteDetails(repoId: number) {
  return useQuery({
    queryKey: remoteDetailKeys.list(repoId),
    queryFn: () => unwrap(commands.listRemoteDetails(repoId)),
    staleTime: 0,
  });
}

function useRemoteChange<T>(
  repoId: number,
  activity: string,
  change: (request: T) => Promise<string>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    // The dialog shows the error itself.
    meta: { silent: true, activity },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: refKeys.all(repoId) }),
  });
}

export function useAddRemote(repoId: number) {
  return useRemoteChange(repoId, "Adding the remote", (request: AddRemoteRequestDto) =>
    unwrap(commands.addRemote(repoId, request)),
  );
}

/** Makes `remote` the one pushing goes to by default (`remote.pushDefault`, this repository). */
export function useSetPushDefault(repoId: number) {
  return useRemoteChange(repoId, "Setting where pushing goes", async (remote: string) => {
    await unwrap(commands.setGitConfig(repoId, "local", "remote.pushDefault", remote));
    return "";
  });
}

export function useRemoveRemote(repoId: number) {
  return useRemoteChange(repoId, "Removing the remote", (name: string) =>
    unwrap(commands.removeRemote(repoId, name)),
  );
}
