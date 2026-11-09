import type { ReactNode } from "react";
import { useId, useState } from "react";

import { CommitList } from "@/features/graph";
import { startJob, startPush } from "@/features/jobs";
import { useRepositoryPath } from "@/features/repositories";
import type { PushWhatDto, RefTargetDto } from "@/shared/ipc/bindings";
import { toIpcError } from "@/shared/ipc/client";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useUniqueCommits } from "../api/branches";
import { useRemotes } from "../api/remotes";
import { defaultRemote, splitRemoteBranch } from "../lib/remotes";

type RemoteRefRequest =
  { kind: "push-tag"; tag: string } | { kind: "delete-on-remote"; reference: RefTargetDto };

interface RemoteRefDialogProps {
  repoId: number;
  request: RemoteRefRequest;
  onClose: () => void;
}

/** For a remote branch being deleted: the commits only it holds, which others lose too. */
function RemoteBranchLoss({ repoId, reference }: { repoId: number; reference: RefTargetDto }) {
  const unique = useUniqueCommits(repoId, reference);
  if (unique.error) return <>Counting its commits failed: {toIpcError(unique.error).message}</>;
  if (!unique.data) return <>Counting the commits only it holds…</>;
  if (unique.data.count === 0) {
    return <>Every commit on it is also on another branch or tag; only the name goes.</>;
  }
  return (
    <>
      {unique.data.count === 1
        ? "1 commit is on no other branch or tag. Without it, nobody sees it any more:"
        : `${unique.data.count.toLocaleString()} commits are on no other branch or tag. Without it, nobody sees them any more:`}
      <CommitList commits={unique.data} />
    </>
  );
}

/**
 * Pushing a tag, or deleting a remote branch or a tag on a remote. A remote branch names its
 * remote; a tag asks which one.
 */
export function RemoteRefDialog({ repoId, request, onClose }: RemoteRefDialogProps) {
  const id = useId();
  const path = useRepositoryPath(repoId);
  const remotes = useRemotes(repoId).data;
  const [chosen, setChosen] = useState<string>();
  if (!remotes) return null;
  const isRemoteBranch =
    request.kind === "delete-on-remote" && request.reference.namespace === "remote";
  const split = isRemoteBranch ? splitRemoteBranch(request.reference.name, remotes) : null;
  const remote = split?.remote ?? chosen ?? defaultRemote(remotes);

  let title: string;
  let body: ReactNode;
  let what: PushWhatDto | null;
  let confirm: string;
  if (request.kind === "push-tag") {
    // With one remote there is nothing to choose, so the title names it.
    title =
      remotes.length === 1 && remote !== undefined
        ? `Push the tag ${request.tag} to ${remote}`
        : `Push the tag ${request.tag}`;
    body = "Others get it with their next fetch.";
    what = { type: "tag", name: request.tag };
    confirm = "Push tag";
  } else if (isRemoteBranch) {
    const branch = split?.branch ?? request.reference.name;
    title = `Delete ${branch} on ${remote ?? "the remote"}?`;
    body = (
      <>
        It goes for everyone who uses {remote}, and {request.reference.name} goes here.{" "}
        <RemoteBranchLoss repoId={repoId} reference={request.reference} />
      </>
    );
    what = split ? { type: "delete", reference: `refs/heads/${split.branch}` } : null;
    confirm = `Delete on ${remote ?? "the remote"}`;
  } else {
    title = `Delete the tag ${request.reference.name} on a remote?`;
    body = "It goes for everyone who uses that remote; your own tag stays.";
    what = { type: "delete", reference: `refs/tags/${request.reference.name}` };
    confirm = "Delete on the remote";
  }
  const canRun = what !== null && remote !== undefined && path !== undefined;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div>{body}</div>
          </DialogDescription>
        </DialogHeader>
        {remotes.length === 0 && (
          <p className="text-sm text-destructive">This repository has no remote.</p>
        )}
        {!isRemoteBranch && remotes.length > 1 && (
          <label htmlFor={`${id}-remote`} className="flex items-center gap-3 text-sm font-medium">
            Remote
            <select
              id={`${id}-remote`}
              value={remote}
              className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => {
                setChosen(event.target.value);
              }}
            >
              {remotes.map((candidate) => (
                <option key={candidate}>{candidate}</option>
              ))}
            </select>
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={request.kind === "push-tag" ? "default" : "destructive"}
            disabled={!canRun}
            onClick={() => {
              if (!what || remote === undefined || path === undefined) return;
              startJob(startPush({ path, remote, what }), "push");
              onClose();
            }}
          >
            {confirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
