/** Repository changes started from the UI. */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { RepoSummary } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { sessionKeys } from "./session";

/** Runs `git init` in a folder. */
export function useInitRepository() {
  return useMutation({
    mutationFn: (path: string) => unwrap(commands.initRepository(path)),
  });
}

/** Writes the commit-graph file and updates the tab's summary. */
export function useWriteCommitGraph(tabPath: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repoId: number) => unwrap(commands.writeCommitGraph(repoId)),
    onSuccess: (summary: RepoSummary) => {
      queryClient.setQueryData(sessionKeys.byPath(tabPath), summary);
    },
  });
}
