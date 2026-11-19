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

/** Saves `edit` all or nothing; the remotes, refs and settings are read again. */
export function useApplyRemoteChanges(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (edit: RemoteEditDto) => unwrap(commands.applyRemoteChanges(repoId, edit)),
    meta: { silent: true, activity: "Saving the remote" },
    onSettled: () => queryClient.invalidateQueries({ queryKey: refKeys.all(repoId) }),
  });
}
