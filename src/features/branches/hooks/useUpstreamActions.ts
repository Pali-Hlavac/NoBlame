import { useCallback } from "react";
import { toast } from "sonner";

import { toIpcError } from "@/shared/ipc/client";

import { useSetUpstream } from "../api/upstreams";
import type { UpstreamMenuActions } from "../lib/menu";
import { upstreamName } from "../lib/tracking";
import { openBranchDialog } from "../store/dialog";

/**
 * The upstream entries for a local branch's menu: choosing one opens a dialog; removing it
 * runs at once (only the branch's config changes, and it can be set again).
 */
export function useUpstreamActions(repoId: number) {
  const { mutate } = useSetUpstream(repoId);
  return useCallback(
    (branch: string, current: string | null): UpstreamMenuActions => ({
      has: current !== null,
      set: () => {
        openBranchDialog({ kind: "set-upstream", repoId, branch, current });
      },
      unset: () => {
        mutate(
          { branch, upstream: null },
          {
            onSuccess: () => {
              const was = current === null ? "" : ` (was ${upstreamName(current)})`;
              toast.success(`${branch} has no upstream now${was}`);
            },
            onError: (error) => {
              toast.error(`Could not remove the upstream of ${branch}`, {
                description: toIpcError(error).message,
                classNames: { description: "whitespace-pre-line" },
              });
            },
          },
        );
      },
    }),
    [mutate, repoId],
  );
}
