import type { ReactNode } from "react";

import { toIpcError } from "@/shared/ipc/client";

import { useMissingCommits } from "../api/remotes";
import { CommitList } from "./CommitList";

interface ForceWarningProps {
  repoId: number;
  /** The local branch pushed. */
  branch: string;
  /** The remote branch replaced (`origin/main`), or null when it does not exist yet. */
  remoteBranch: string | null;
}

/** What a force push takes off the remote branch: the commits there that `branch` lacks. */
export function ForceWarning({ repoId, branch, remoteBranch }: ForceWarningProps) {
  const missing = useMissingCommits(
    repoId,
    remoteBranch === null ? null : `refs/remotes/${remoteBranch}`,
    `refs/heads/${branch}`,
  );
  const lease =
    "It is replaced only if it is still where it is shown here; if someone pushed since your last fetch, nothing changes.";
  let body: ReactNode;
  if (remoteBranch === null) {
    body = "The branch does not exist there yet (as of the last fetch), so nothing is replaced.";
  } else if (missing.error) {
    body = `Counting what would be replaced failed: ${toIpcError(missing.error).message}`;
  } else if (!missing.data) {
    body = "Counting the commits that would be removed…";
  } else if (missing.data.count === 0) {
    body = `${remoteBranch} has no commits that ${branch} lacks; nothing is removed.`;
  } else {
    body = (
      <>
        {missing.data.count === 1
          ? `1 commit on ${remoteBranch} is not in ${branch}. Forcing removes it from the branch for everyone:`
          : `${missing.data.count.toLocaleString()} commits on ${remoteBranch} are not in ${branch}. Forcing removes them from the branch for everyone:`}
        <CommitList commits={missing.data} />
      </>
    );
  }
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/50 bg-destructive/5 p-2 text-sm"
    >
      {body}
      <span className="mt-2 block text-xs text-muted-foreground">{lease}</span>
    </div>
  );
}
