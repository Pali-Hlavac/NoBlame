import { toast } from "sonner";

import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { actionDone } from "@/shared/lib/actionDone";

import { useCheckoutCommit } from "../api/branches";
import { openBranchDialog, type StartPoint } from "../store/dialog";

interface CheckoutCommitDialogProps {
  repoId: number;
  commit: StartPoint;
  onClose: () => void;
}

/** Explains a detached HEAD before checking out a commit, and offers a branch instead. */
export function CheckoutCommitDialog({ repoId, commit, onClose }: CheckoutCommitDialogProps) {
  const checkout = useCheckoutCommit(repoId);
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Check out this commit?"
      description={
        <>
          The working tree shows {commit.label}, but you are not on a branch then (a “detached
          HEAD”). Commits you make there belong to no branch: create one before switching away, or
          they are no longer shown.{" "}
          <button
            type="button"
            className="text-primary underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => {
              openBranchDialog({ kind: "create-branch", repoId, start: commit });
            }}
          >
            Create a branch here instead…
          </button>
        </>
      }
      confirmLabel={checkout.isPending ? "Checking out…" : "Check out"}
      pending={checkout.isPending}
      error={checkout.error}
      onConfirm={() => {
        checkout.mutate(commit.revision, {
          onSuccess: () => {
            toast.success(`Checked out ${commit.label}`);
            actionDone("switch");
            onClose();
          },
        });
      }}
    />
  );
}
