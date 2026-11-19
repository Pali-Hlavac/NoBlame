/**
 * Asking a remote without fetching (Test connection, its default branch: jobs, so credentials
 * can be asked), moving passwords out of its URLs, and opening its web page.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { refKeys } from "@/features/graph";
import { startJob } from "@/features/jobs";
import { commands, unwrap } from "@/shared/ipc/client";

/** Tests the connection to `remote` (`git ls-remote --heads`); the job's toast says how it went. */
export function startTestConnection(path: string, remote: string): void {
  startJob(unwrap(commands.testRemoteConnection(path, remote)), "testConnection");
}

/** Sets `remote`'s default branch here to the server's (`git remote set-head --auto`). */
export function startAskDefaultBranch(path: string, remote: string): void {
  startJob(unwrap(commands.askRemoteDefaultBranch(path, remote)), "setHead");
}

/** Moves the passwords in `remote`'s URLs to the credential helper; how many moved. */
export function useMovePasswords(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (remote: string) => unwrap(commands.moveRemotePasswords(repoId, remote)),
    meta: { silent: true, activity: "Moving the password" },
    onSettled: () => queryClient.invalidateQueries({ queryKey: refKeys.all(repoId) }),
  });
}

/** Opens a web page in the default browser (only http and https addresses). */
export function openWebPage(url: string): Promise<null> {
  return unwrap(commands.openWebPage(url));
}

/** Makes the credential helpers forget the sign-in kept for `remote`'s addresses; how many. */
export function useForgetCredentials(repoId: number) {
  return useMutation({
    mutationFn: (remote: string) => unwrap(commands.forgetRemoteCredentials(repoId, remote)),
    meta: { silent: true, activity: "Forgetting the sign-in" },
  });
}
