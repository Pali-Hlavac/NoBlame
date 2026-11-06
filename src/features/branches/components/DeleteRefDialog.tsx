import { toast } from "sonner";

import { shortId } from "@/features/graph";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import type { RefTargetDto, UniqueCommitsDto } from "@/shared/ipc/bindings";
import { toIpcError } from "@/shared/ipc/client";

import { useDeleteRef, useUniqueCommits } from "../api/branches";

interface DeleteRefDialogProps {
  repoId: number;
  reference: RefTargetDto;
  onClose: () => void;
}

const WORDS = { branch: "branch", tag: "tag", remote: "remote branch" } as const;

/** What deleting loses: the commits no other branch or tag holds, the newest named. */
function Loss({ unique, what }: { unique: UniqueCommitsDto; what: string }) {
  if (unique.count === 0) {
    return <>Every commit on it stays on another branch or tag; only the name goes.</>;
  }
  const more = unique.count - unique.newest.length;
  return (
    <>
      {unique.count === 1
        ? `1 commit is on no other branch or tag. Without the ${what} it is no longer shown:`
        : `${unique.count.toLocaleString()} commits are on no other branch or tag. Without the ${what} they are no longer shown:`}
      <span className="mt-2 block rounded-md border border-border p-2 font-mono text-xs text-foreground">
        {unique.newest.map((commit) => (
          <span key={commit.id} className="block truncate">
            {shortId(commit.id)} {commit.summary}
          </span>
        ))}
        {more > 0 && (
          <span className="block text-muted-foreground">
            and {more.toLocaleString()} older {more === 1 ? "commit" : "commits"}
          </span>
        )}
      </span>
      <span className="mt-2 block">
        Git keeps them for a while; until then a new branch at {shortId(unique.newest[0]?.id ?? "")}{" "}
        brings them back.
      </span>
    </>
  );
}

/** Asks before deleting a local branch or a tag, naming the commits only it holds. */
export function DeleteRefDialog({ repoId, reference, onClose }: DeleteRefDialogProps) {
  const unique = useUniqueCommits(repoId, reference);
  const remove = useDeleteRef(repoId);
  const what = WORDS[reference.namespace];
  const tagNote =
    reference.namespace === "tag" ? " A copy already pushed to a remote stays there." : "";
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Delete the ${what} ${reference.name}?`}
      description={
        unique.data ? (
          <>
            <Loss unique={unique.data} what={what} />
            {tagNote}
          </>
        ) : unique.error ? (
          `Counting the commits only it holds failed: ${toIpcError(unique.error).message}`
        ) : (
          "Counting the commits only it holds…"
        )
      }
      confirmLabel={remove.isPending ? "Deleting…" : "Delete"}
      destructive
      pending={remove.isPending || !unique.data}
      error={remove.error}
      onConfirm={() => {
        remove.mutate(reference, {
          onSuccess: () => {
            toast.success(`Deleted the ${what} ${reference.name}`);
            onClose();
          },
        });
      }}
    />
  );
}
