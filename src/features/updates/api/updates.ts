/** Updating NoBlame (ADR 0017): whether this build can, checking the feed, installing. */
import { useMutation, useQuery } from "@tanstack/react-query";

import { commands, unwrap } from "@/shared/ipc/client";

/** Whether this build updates itself, and its version; never changes while it runs. */
export function useUpdateSupport() {
  return useQuery({
    queryKey: ["update-support"],
    queryFn: () => commands.getUpdateSupport(),
    staleTime: Infinity,
  });
}

/** Asks the release feed for a newer version (null: this one is the newest). */
export function checkForUpdate() {
  return unwrap(commands.checkForUpdate());
}

/** Downloads and installs the checked update; NoBlame restarts when it is done. */
export function useInstallUpdate() {
  return useMutation({
    meta: { silent: true },
    mutationFn: () => unwrap(commands.installUpdate()),
  });
}
