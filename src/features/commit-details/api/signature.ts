/** Checking a commit's signature (runs the user's gpg, ssh-keygen or gpgsm in the backend). */
import { useQuery } from "@tanstack/react-query";

import { graphKeys } from "@/features/graph";
import { commands, unwrap } from "@/shared/ipc/client";

/** Under the graph's keys, so closing the repository forgets them too. */
export const signatureKeys = {
  commit: (repoId: number, commitId: string) =>
    [...graphKeys.all(repoId), "signature", commitId] as const,
};

/**
 * The signature check of `commitId`, when `enabled` (the commit is signed). Checked again when
 * the window regains focus: importing a key or editing the allowed signers changes the answer.
 */
export function useSignatureCheck(repoId: number, commitId: string, enabled: boolean) {
  return useQuery({
    queryKey: signatureKeys.commit(repoId, commitId),
    queryFn: () => unwrap(commands.verifyCommitSignature(repoId, commitId)),
    enabled,
    refetchOnWindowFocus: true,
  });
}
