import { useMemo } from "react";
import { toast } from "sonner";

import { useSetUpstream } from "../api/upstreams";
import { useRefNames } from "../hooks/useRefNames";
import { suggestedUpstream, upstreamName, upstreamProblem, upstreamRef } from "../lib/tracking";
import { NameDialog } from "./NameDialog";

interface SetUpstreamDialogProps {
  repoId: number;
  branch: string;
  /** The branch's upstream now (full name), if it has one. */
  current: string | null;
  onClose: () => void;
}

/** “Set upstream”: the remote branch (or local branch) a local branch tracks. */
export function SetUpstreamDialog({ repoId, branch, current, onClose }: SetUpstreamDialogProps) {
  const names = useRefNames(repoId);
  const setUpstream = useSetUpstream(repoId);
  const suggestions = useMemo(
    () => [...names.remotes, ...[...names.branches].filter((name) => name !== branch)],
    [names, branch],
  );
  // The suggested upstream depends on the remote branches; wait for them.
  if (!names.loaded) return null;
  return (
    <NameDialog
      title={`${current ? "Change" : "Set"} the upstream of ${branch}`}
      description={
        current
          ? `It tracks ${upstreamName(current)} now. Pull and push use the upstream, and the Branches list shows how far apart they are.`
          : "Pull and push use the upstream, and the Branches list shows how far apart they are."
      }
      label="Upstream branch"
      initialName={suggestedUpstream(branch, current, names.remotes)}
      suggestions={suggestions}
      problemOf={(name) => upstreamProblem(name, branch, names)}
      submitLabel="Set upstream"
      pendingLabel="Setting…"
      pending={setUpstream.isPending}
      error={setUpstream.error}
      onClose={onClose}
      onSubmit={(name) => {
        const upstream = upstreamRef(name, names);
        if (upstream === null) return;
        setUpstream.mutate(
          { branch, upstream },
          {
            onSuccess: () => {
              toast.success(`${branch} now tracks ${name}`);
              onClose();
            },
          },
        );
      }}
    />
  );
}
