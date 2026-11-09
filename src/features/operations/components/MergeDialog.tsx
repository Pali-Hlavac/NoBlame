import { useId, useState } from "react";

import type { StartPoint } from "@/features/graph";
import { InlineError } from "@/shared/components/InlineError";
import type { MergeModeDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useMerge } from "../api/operations";
import { useCurrentBranch } from "../hooks/useCurrentBranch";
import { showOutcome } from "../lib/outcome";
import { MERGE_MODES, mergeToast } from "../lib/words";
import { Choice } from "./Choice";

interface MergeDialogProps {
  repoId: number;
  source: StartPoint;
  onClose: () => void;
}

/**
 * Merging a branch, tag or commit into the current branch: how (fast-forward when possible, a
 * merge commit, fast-forward only, squash), then a toast says what happened. Conflicts close
 * the dialog: the bar above the commits then offers Continue and Abort.
 */
export function MergeDialog({ repoId, source, onClose }: MergeDialogProps) {
  const id = useId();
  const [mode, setMode] = useState<MergeModeDto>("default");
  const merge = useMerge(repoId);
  const target = useCurrentBranch(repoId);

  const submit = () => {
    merge.mutate(
      { revision: source.revision, mode },
      {
        onSuccess: (result) => {
          showOutcome(mergeToast(result, source.label, target));
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
              Merge {source.label} into {target}
            </DialogTitle>
            <DialogDescription>
              Its commits join {target}. Uncommitted changes git would overwrite stop the merge
              before it starts.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 font-medium">How</legend>
            {MERGE_MODES.map((choice) => (
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
          {merge.error ? <InlineError error={merge.error} /> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={merge.isPending}>
              {merge.isPending ? "Merging…" : "Merge"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
