/**
 * One remote's settings for the remote editor, the commands saving would run, and saving.
 * The settings are read once per editing session (no refetch on focus): the editor compares
 * its changes against what it showed, and the backend refuses to save when the file changed.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { refKeys } from "@/features/graph";
import type { RemoteEditDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

export const remoteSettingsKeys = {
  one: (repoId: number, name: string) => [...refKeys.all(repoId), "remote-settings", name] as const,
};

export function useRemoteSettings(repoId: number, name: string) {
  return useQuery({
    queryKey: remoteSettingsKeys.one(repoId, name),
    queryFn: () => unwrap(commands.getRemoteSettings(repoId, name)),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** The commands saving `edit` would run, secrets hidden. */
export function usePreviewRemoteChanges(repoId: number) {
  return useMutation({
    mutationFn: (edit: RemoteEditDto) => unwrap(commands.previewRemoteChanges(repoId, edit)),
    // The editor shows the error itself.
    meta: { silent: true, activity: "Checking the changes" },
  });
}

/**
 * What a save writes: NoBlame's SSH key for the remote first (under its current name, so a bad
 * path stops the save before git's settings change; a rename moves it along), then git's settings,
 * all or nothing.
 */
export interface RemoteSave {
  edit: RemoteEditDto | null;
  /** The remote's current name and its key (null: none), when the key changed. */
  sshKey: { remote: string; key: string | null } | null;
}

/** Saves the editor's changes; the remotes, refs and settings are read again. */
export function useApplyRemoteChanges(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ edit, sshKey }: RemoteSave) => {
      if (sshKey) await unwrap(commands.setRemoteSshKey(repoId, sshKey.remote, sshKey.key));
      if (edit) await unwrap(commands.applyRemoteChanges(repoId, edit));
      return null;
    },
    meta: { silent: true, activity: "Saving the remote" },
    onSettled: () => queryClient.invalidateQueries({ queryKey: refKeys.all(repoId) }),
  });
}
