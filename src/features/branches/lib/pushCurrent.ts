/**
 * The toolbar's Push: the current branch goes straight to its upstream when that is a remote
 * branch; otherwise (no upstream, or a local one) the Push dialog asks where.
 */
import type { QueryClient } from "@tanstack/react-query";

import { startJob, startPush } from "@/features/jobs";
import { commands, unwrap } from "@/shared/ipc/client";

import { remoteKeys } from "../api/remotes";
import { upstreamKeys } from "../api/upstreams";
import { openBranchDialog } from "../store/dialog";
import { upstreamOnRemote } from "./remotes";

/** Pushes `branch` of session `repoId` (at `path`) to its upstream, or opens the dialog. */
export async function pushCurrentBranch(
  queryClient: QueryClient,
  repoId: number,
  path: string,
  branch: string,
): Promise<void> {
  const [upstreams, remotes] = await Promise.all([
    queryClient.query({
      queryKey: upstreamKeys.list(repoId),
      queryFn: () => unwrap(commands.getUpstreams(repoId)),
      staleTime: Infinity,
    }),
    queryClient.query({
      queryKey: remoteKeys.list(repoId),
      queryFn: () => unwrap(commands.listRemotes(path)),
      staleTime: Infinity,
    }),
  ]);
  const upstream = upstreams.find((entry) => entry.branch === branch);
  const target = upstream ? upstreamOnRemote(upstream.upstream, remotes) : null;
  if (!target) {
    openBranchDialog({ kind: "push-branch", repoId, branch });
    return;
  }
  startJob(
    startPush({
      path,
      remote: target.remote,
      what: {
        type: "branch",
        local: branch,
        remoteBranch: target.branch,
        setUpstream: false,
        followTags: false,
        force: false,
        expected: null,
      },
    }),
    "push",
  );
}
