import { useId, useState } from "react";

import type { StartPoint } from "@/features/graph";
import { useWorkingTreeStatus } from "@/features/working-tree";
import { InlineError } from "@/shared/components/InlineError";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useRebase, useRebasePreview } from "../api/rebase";
import { useCurrentBranch } from "../hooks/useCurrentBranch";
import { showOutcome } from "../lib/outcome";
import { rebaseToast } from "../lib/rebase";
import { Choice } from "@/shared/components/Choice";
import { RebasePreview } from "./RebasePreview";

interface RebaseDialogProps {
  repoId: number;
  onto: StartPoint;
  onClose: () => void;
}

/**
 * Rebasing the current branch onto a branch, tag or commit: the commits replayed (and whether
 * they were pushed) named first, then whether to stash uncommitted changes meanwhile and to
 * keep merge commits. Conflicts close the dialog: the bar above the commits takes over.
 */
export function RebaseDialog({ repoId, onto, onClose }: RebaseDialogProps) {
  const id = useId();
  const rebase = useRebase(repoId);
  const preview = useRebasePreview(repoId, onto.revision);
  const target = useCurrentBranch(repoId);
  const summary = useWorkingTreeStatus(repoId).data?.summary;
  const changed = summary ? summary.staged + summary.unstaged > 0 : false;
  // Stash meanwhile when there are changes, until the user decides.
  const [autostashChoice, setAutostash] = useState<boolean | null>(null);
  const autostash = autostashChoice ?? changed;
  const [rebaseMerges, setRebaseMerges] = useState(false);

  const submit = () => {
    rebase.mutate(
      { onto: onto.revision, autostash, rebaseMerges },
      {
        onSuccess: (outcome) => {
          const published = (preview.data?.published ?? 0) > 0;
          showOutcome(rebaseToast(outcome, target, onto.label, published));
          onClose();
        },
      },
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <form
          className="flex min-w-0 flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle className="break-words">
              Rebase {target} onto {onto.label}
            </DialogTitle>
            <DialogDescription>
              The commits {target} has of its own are replayed one by one on top of {onto.label}.
            </DialogDescription>
          </DialogHeader>
          <RebasePreview target={target} onto={onto.label} preview={preview} />
          <div className="flex flex-col gap-2 text-sm">
            <Choice
              id={`${id}-autostash`}
              type="checkbox"
              checked={autostash}
              onChange={setAutostash}
              label="Stash my uncommitted changes meanwhile"
              detail={
                changed
                  ? "You have uncommitted changes; without this git refuses to rebase (--autostash)."
                  : "They come back after the rebase (--autostash)."
              }
            />
            <Choice
              id={`${id}-merges`}
              type="checkbox"
              checked={rebaseMerges}
              onChange={setRebaseMerges}
              label="Keep merge commits"
              detail="Without it, merge commits are left out and their commits come in one line (--rebase-merges)."
            />
          </div>
          {rebase.error ? <InlineError error={rebase.error} /> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={rebase.isPending}>
              {rebase.isPending ? "Rebasing…" : "Rebase"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
