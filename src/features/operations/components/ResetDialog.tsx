import { useId, useState } from "react";
import { toast } from "sonner";

import type { StartPoint } from "@/features/graph";
import { InlineError } from "@/shared/components/InlineError";
import type { ResetModeDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useReset } from "../api/history";
import { useCurrentBranch } from "../hooks/useCurrentBranch";
import { RESET_MODES } from "../lib/history";
import { Choice } from "./Choice";
import { ResetEffects } from "./ResetEffects";

interface ResetDialogProps {
  repoId: number;
  commit: StartPoint;
  onClose: () => void;
}

/**
 * Resetting the current branch to a commit: soft, mixed (git's default), keep or hard, with
 * what leaves the branch and, for hard, the uncommitted changes that are lost, named before it
 * runs (the dialog is the confirmation).
 */
export function ResetDialog({ repoId, commit, onClose }: ResetDialogProps) {
  const id = useId();
  const [mode, setMode] = useState<ResetModeDto>("mixed");
  const reset = useReset(repoId);
  const target = useCurrentBranch(repoId);
  const hard = mode === "hard";

  const submit = () => {
    reset.mutate(
      { commit: commit.revision, mode },
      {
        onSuccess: () => {
          toast.success(`Reset ${target} to ${commit.label}`);
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
              Reset {target} to {commit.label}
            </DialogTitle>
            <DialogDescription>
              {target} will point at this commit. Choose what happens to your files.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 font-medium">How</legend>
            {RESET_MODES.map((choice) => (
              <Choice
                key={choice.mode}
                id={`${id}-${choice.mode}`}
                type="radio"
                name={`${id}-mode`}
                checked={mode === choice.mode}
                onChange={() => {
                  setMode(choice.mode);
                }}
                label={choice.label}
                detail={choice.detail}
              />
            ))}
          </fieldset>
          <ResetEffects repoId={repoId} commit={commit.revision} target={target} mode={mode} />
          {reset.error ? <InlineError error={reset.error} /> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={hard ? "destructive" : "default"}
              disabled={reset.isPending}
            >
              {reset.isPending ? "Resetting…" : hard ? "Reset and discard changes" : "Reset"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
