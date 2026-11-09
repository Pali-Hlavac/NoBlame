import { useId, useState } from "react";
import { toast } from "sonner";

import type { StartPoint } from "@/features/graph";
import { useActiveRepository } from "@/features/repositories";
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
import { MERGE_MODES, mergeToast } from "../lib/words";

/** The conflict toast stays a while longer than others: it says what to do next. */
const CONFLICT_TOAST_MS = 12_000;

const RADIO_CLASS =
  "mt-0.5 size-4 shrink-0 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

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
  const { summary } = useActiveRepository();
  const head = summary?.id === repoId ? summary.head : undefined;
  const target = head && head.kind !== "detached" ? head.name : "the current branch";

  const submit = () => {
    merge.mutate(
      { revision: source.revision, mode },
      {
        onSuccess: (result) => {
          const { title, description, tone } = mergeToast(result, source.label, target);
          // The bar above the commits stays while the merge is in progress; the toast need not.
          if (tone === "warning")
            toast.warning(title, { description, duration: CONFLICT_TOAST_MS });
          else if (tone === "info") toast.info(title, { description });
          else toast.success(title, { description });
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
              <div key={choice.mode} className="flex items-start gap-2">
                <input
                  id={`${id}-${choice.mode}`}
                  type="radio"
                  name={`${id}-mode`}
                  className={RADIO_CLASS}
                  checked={mode === choice.mode}
                  aria-describedby={`${id}-${choice.mode}-detail`}
                  onChange={() => {
                    setMode(choice.mode);
                  }}
                />
                <div className="min-w-0">
                  <label htmlFor={`${id}-${choice.mode}`} className="block">
                    {choice.label}
                  </label>
                  <p id={`${id}-${choice.mode}-detail`} className="text-xs text-muted-foreground">
                    {choice.detail}
                  </p>
                </div>
              </div>
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
