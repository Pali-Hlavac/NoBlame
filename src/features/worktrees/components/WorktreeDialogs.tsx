import { useId, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import type { WorktreeDto } from "@/shared/ipc/bindings";

import {
  useLockWorktree,
  usePruneWorktrees,
  useRemoveWorktree,
  useWorktreeChanges,
} from "../api/worktrees";
import { changesText, checkedOut, folderName } from "../lib/worktrees";
import { useWorktreeDialog } from "../store/dialog";
import { AddWorktreeDialog } from "./AddWorktreeDialog";

interface DialogProps {
  repoId: number;
  onClose: () => void;
}

/** Removing a worktree: its folder goes; uncommitted files are named and need the force. */
function RemoveWorktreeDialog({
  repoId,
  worktree,
  onClose,
}: DialogProps & { worktree: WorktreeDto }) {
  const remove = useRemoveWorktree(repoId);
  const counts = useWorktreeChanges(worktree.path);
  const name = folderName(worktree.path);
  const changes = changesText(counts.data);
  const keeps = worktree.branch ? ` The branch ${worktree.branch} stays.` : "";
  let description;
  if (counts.isPending) description = "Counting the uncommitted files…";
  else if (changes) {
    description = `${worktree.path} has ${changes} not committed. Removing it deletes them with the folder; NoBlame keeps no copy.${keeps}`;
  } else {
    description = `Deletes the folder ${worktree.path} (files Git ignores, such as build output, go with it).${keeps}`;
  }
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Remove the worktree ${name}?`}
      description={description}
      confirmLabel={changes ? "Remove with its changes" : "Remove"}
      destructive
      pending={remove.isPending || counts.isPending}
      error={remove.error}
      onConfirm={() => {
        remove.mutate(
          { folder: worktree.path, force: changes !== null },
          {
            onSuccess: () => {
              toast.success(`Removed the worktree ${name}`);
              onClose();
            },
          },
        );
      }}
    />
  );
}

/** Locking a worktree, with an optional reason. */
function LockWorktreeDialog({
  repoId,
  worktree,
  onClose,
}: DialogProps & { worktree: WorktreeDto }) {
  const id = useId();
  const lock = useLockWorktree(repoId);
  const [reason, setReason] = useState("");
  const name = folderName(worktree.path);
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Lock the worktree ${name}?`}
      description={
        <>
          <span className="block">
            Git then does not prune, move or remove it: for a worktree on a removable drive or a
            network share that is not always there.
          </span>
          <label
            htmlFor={`${id}-reason`}
            className="mt-3 block text-sm font-medium text-foreground"
          >
            Reason (optional)
          </label>
          <input
            id={`${id}-reason`}
            value={reason}
            autoComplete="off"
            className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
        </>
      }
      confirmLabel="Lock"
      pending={lock.isPending}
      error={lock.error}
      onConfirm={() => {
        lock.mutate(
          { folder: worktree.path, reason },
          {
            onSuccess: () => {
              toast.success(`Locked ${name}`);
              onClose();
            },
          },
        );
      }}
    />
  );
}

/** Forgetting worktrees whose folders are gone (`git worktree prune`). */
function PruneDialog({
  repoId,
  prunable,
  onClose,
}: DialogProps & { prunable: readonly WorktreeDto[] }) {
  const prune = usePruneWorktrees(repoId);
  const locked = prunable.filter((worktree) => worktree.locked !== null).length;
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Prune worktrees?"
      description={
        <>
          <span className="block">
            Git forgets these worktrees; their folders are gone already. Their branches stay.
          </span>
          <span className="my-2 block space-y-0.5">
            {prunable.map((worktree) => (
              <span key={worktree.path} className="block font-mono text-xs break-all">
                {worktree.path} ({checkedOut(worktree)})
              </span>
            ))}
          </span>
          {locked > 0 && <span className="block">Locked ones stay until they are unlocked.</span>}
        </>
      }
      confirmLabel="Prune"
      pending={prune.isPending}
      error={prune.error}
      onConfirm={() => {
        prune.mutate(undefined, {
          onSuccess: () => {
            toast.success("Pruned the worktrees whose folders were gone");
            onClose();
          },
        });
      }}
    />
  );
}

/** The open worktree dialog, if any. */
export function WorktreeDialogs({
  repoId,
  worktrees,
}: {
  repoId: number;
  worktrees: readonly WorktreeDto[];
}) {
  const dialog = useWorktreeDialog((state) => state.dialog);
  const close = useWorktreeDialog((state) => state.close);
  switch (dialog?.kind) {
    case "add":
      return <AddWorktreeDialog repoId={repoId} worktrees={worktrees} onClose={close} />;
    case "remove":
      return <RemoveWorktreeDialog repoId={repoId} worktree={dialog.worktree} onClose={close} />;
    case "lock":
      return <LockWorktreeDialog repoId={repoId} worktree={dialog.worktree} onClose={close} />;
    case "prune":
      return <PruneDialog repoId={repoId} prunable={dialog.prunable} onClose={close} />;
    case undefined:
      return null;
  }
}
