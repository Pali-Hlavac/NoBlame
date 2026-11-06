/**
 * Prompts from git or ssh, running for a background job, that wait for the user (ADR 0012).
 * The backend's list is the source of truth; `CredentialRequested` and `CredentialClosed` say
 * when to read it again.
 */
import { useQuery } from "@tanstack/react-query";

import { commands } from "@/shared/ipc/client";

export const credentialKeys = {
  list: ["credentials"] as const,
};

/** Prompts waiting for an answer, oldest first. */
export function useCredentialRequests() {
  return useQuery({
    queryKey: credentialKeys.list,
    queryFn: () => commands.listCredentialRequests(),
    staleTime: Infinity,
  });
}

/** Answers prompt `id`; `null` cancels it (git then fails). The answer is not kept. */
export function answerCredential(id: number, answer: string | null): Promise<boolean> {
  return commands.answerCredential(id, answer);
}
