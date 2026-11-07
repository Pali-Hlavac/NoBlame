import { useId, useMemo, useState } from "react";

import { useRefs } from "@/features/graph";

import { startJob, startPush } from "@/features/jobs";
import { openRemotes } from "@/features/remotes";
import { useRepositoryPath } from "@/features/repositories";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useRemotes } from "../api/remotes";
import { useUpstreams } from "../api/upstreams";
import { refNameProblem } from "../lib/names";
import { defaultRemote, upstreamOnRemote } from "../lib/remotes";
import { DialogCheckbox } from "./NameDialog";
import { ForceWarning } from "./ForceWarning";

interface PushDialogProps {
  repoId: number;
  branch: string;
  onClose: () => void;
}

const FIELD =
  "h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * “Push”: a local branch to a remote. Starts from its upstream (or `origin` and the same name,
 * made the upstream); force replaces the remote branch only where the last fetch saw it, and
 * names the commits that would go.
 */
export function PushDialog({ repoId, branch, onClose }: PushDialogProps) {
  const remotes = useRemotes(repoId);
  const upstreams = useUpstreams(repoId);
  const refs = useRefs(repoId).data;
  // Remote branches as the last fetch saw them: name → commit (the lease of a force push).
  const remoteTips = useMemo(
    () =>
      new Map(
        (refs ?? [])
          .filter((entry) => entry.label.kind === "remote")
          .map((entry) => [entry.label.name, entry.target]),
      ),
    [refs],
  );
  if (!remotes.data || !upstreams.data || !refs) return null;
  const upstream = upstreams.data.find((entry) => entry.branch === branch);
  const tracked = upstream ? upstreamOnRemote(upstream.upstream, remotes.data) : null;
  return (
    <PushForm
      repoId={repoId}
      branch={branch}
      remotes={remotes.data}
      remoteTips={remoteTips}
      initialRemote={defaultRemote(remotes.data, tracked?.remote) ?? ""}
      initialName={tracked?.branch ?? branch}
      hasUpstream={upstream !== undefined}
      onClose={onClose}
    />
  );
}

interface PushFormProps {
  repoId: number;
  branch: string;
  remotes: readonly string[];
  /** Remote branches the last fetch saw (`origin/main`) and their commits. */
  remoteTips: ReadonlyMap<string, string>;
  initialRemote: string;
  initialName: string;
  hasUpstream: boolean;
  onClose: () => void;
}

function PushForm(props: PushFormProps) {
  const id = useId();
  const path = useRepositoryPath(props.repoId);
  const [remote, setRemote] = useState(props.initialRemote);
  const [name, setName] = useState(props.initialName);
  const [setUpstream, setSetUpstream] = useState(!props.hasUpstream);
  const [followTags, setFollowTags] = useState(false);
  const [force, setForce] = useState(false);
  const trimmed = name.trim();
  const problem =
    props.remotes.length === 0 ? "This repository has no remote." : refNameProblem(trimmed);
  const shownTip = props.remoteTips.get(`${remote}/${trimmed}`);
  const exists = shownTip !== undefined;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (problem || path === undefined) return;
            startJob(
              startPush({
                path,
                remote,
                what: {
                  type: "branch",
                  local: props.branch,
                  remoteBranch: trimmed,
                  setUpstream,
                  followTags,
                  force,
                  // Replaced only if still where this dialog showed it (or still absent).
                  expected: force ? (shownTip ?? null) : null,
                },
              }),
              "push",
            );
            props.onClose();
          }}
        >
          <DialogHeader>
            <DialogTitle>Push {props.branch}</DialogTitle>
            <DialogDescription>
              {exists
                ? `Updates ${remote}/${trimmed} with the commits of ${props.branch}.`
                : `Creates ${trimmed} on ${remote || "the remote"} with the commits of ${props.branch}.`}
            </DialogDescription>
          </DialogHeader>
          {props.remotes.length === 0 ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-destructive">This repository has no remote yet.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  props.onClose();
                  openRemotes(props.repoId, true);
                }}
              >
                Add a remote…
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
                <label htmlFor={`${id}-remote`} className="text-sm font-medium">
                  Remote
                </label>
                <select
                  id={`${id}-remote`}
                  value={remote}
                  className={FIELD}
                  onChange={(event) => {
                    setRemote(event.target.value);
                  }}
                >
                  {props.remotes.map((candidate) => (
                    <option key={candidate}>{candidate}</option>
                  ))}
                </select>
                <label htmlFor={`${id}-name`} className="text-sm font-medium">
                  Branch there
                </label>
                <input
                  id={`${id}-name`}
                  value={name}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={problem !== null}
                  className={`${FIELD} font-mono`}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                />
              </div>
              {problem && <p className="text-xs text-destructive">{problem}</p>}
              <div className="flex flex-col gap-1.5">
                <DialogCheckbox checked={setUpstream} onChange={setSetUpstream}>
                  Make it the upstream of {props.branch}
                </DialogCheckbox>
                <DialogCheckbox checked={followTags} onChange={setFollowTags}>
                  Also push annotated tags on these commits
                </DialogCheckbox>
                <DialogCheckbox checked={force} onChange={setForce}>
                  Force: replace the branch there
                </DialogCheckbox>
              </div>
              {force && (
                <ForceWarning
                  repoId={props.repoId}
                  branch={props.branch}
                  remoteBranch={exists ? `${remote}/${trimmed}` : null}
                />
              )}
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={props.onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={force ? "destructive" : "default"}
              disabled={problem !== null || path === undefined}
            >
              {force ? "Force push" : "Push"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
