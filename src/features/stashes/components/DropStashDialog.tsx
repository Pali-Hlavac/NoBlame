import { toast } from "sonner";

import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import type { StashDto } from "@/shared/ipc/bindings";

import { useDropStash } from "../api/stashes";
import { stashDescription, stashName } from "../lib/files";
import { forgetStash } from "../store/shown";

interface DropStashDialogProps {
  repoId: number;
  repoPath: string;
  /** The stash to drop; `null` closes the dialog. */
  stash: StashDto | null;
  onClose: () => void;
}

/** Asks before dropping a stash, naming it: its changes are gone afterwards. */
export function DropStashDialog({ repoId, repoPath, stash, onClose }: DropStashDialogProps) {
  const drop = useDropStash(repoId);
  return (
    <ConfirmDialog
      open={stash !== null}
      onOpenChange={(open) => {
        if (!open) {
          drop.reset();
          onClose();
        }
      }}
      title={stash ? `Drop ${stashName(stash)}?` : "Drop the stash?"}
      description={
        stash && (
          <>
            The changes saved in “{stashDescription(stash)}”
            {stash.branch ? ` (made on ${stash.branch})` : ""} are deleted for good, except what you
            have already applied.
          </>
        )
      }
      confirmLabel="Drop"
      destructive
      pending={drop.isPending}
      error={drop.error}
      onConfirm={() => {
        if (!stash) return;
        drop.mutate(
          { index: stash.index, id: stash.id },
          {
            onSuccess: () => {
              toast.success(`Dropped ${stashName(stash)}`);
              forgetStash(repoPath, stash.id);
              onClose();
            },
          },
        );
      }}
    />
  );
}
