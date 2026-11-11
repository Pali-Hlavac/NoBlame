import { useId, useState } from "react";

import type { PickSource } from "@/features/graph";
import { InlineError } from "@/shared/components/InlineError";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { usePick } from "../api/history";
import { useCurrentBranch } from "../hooks/useCurrentBranch";
import { type PickKind, pickToast } from "../lib/history";
import { showOutcome } from "../lib/outcome";
import { Choice } from "@/shared/components/Choice";

interface PickDialogProps {
  repoId: number;
  kind: PickKind;
  commit: PickSource;
  onClose: () => void;
}

/** "Parent 1 (the branch it was merged into; usual)". */
function parentLabel(parent: number): string {
  if (parent === 1) return "Parent 1: the branch it was merged into (usual)";
  if (parent === 2) return "Parent 2: the branch that was merged";
  return `Parent ${String(parent)}`;
}

/**
 * Cherry-picking a commit onto the current branch, or reverting it there: commit at once or only
 * stage, note the origin (cherry-pick), and for a merge commit which parent its changes are
 * against. A toast says what happened; conflicts leave the bar above the commits.
 */
export function PickDialog({ repoId, kind, commit, onClose }: PickDialogProps) {
  const id = useId();
  const [noCommit, setNoCommit] = useState(false);
  const [recordOrigin, setRecordOrigin] = useState(false);
  const [mainline, setMainline] = useState(1);
  const pick = usePick(repoId, kind);
  const target = useCurrentBranch(repoId);
  const cherry = kind === "cherryPick";
  const merge = commit.parentCount > 1;
  const parents = Array.from({ length: commit.parentCount }, (_, index) => index + 1);

  const submit = () => {
    pick.mutate(
      {
        kind,
        commit: commit.revision,
        mainline: merge ? mainline : null,
        noCommit,
        recordOrigin: cherry && recordOrigin,
      },
      {
        onSuccess: (result) => {
          showOutcome(pickToast(kind, result, commit.label, target));
          onClose();
        },
      },
    );
  };

  const verb = cherry ? "Cherry-pick" : "Revert";
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
              {verb} {commit.label}
            </DialogTitle>
            <DialogDescription>
              {cherry
                ? `Its changes become a new commit on ${target}.`
                : `A new commit on ${target} undoes its changes.`}{" "}
              Uncommitted changes git would overwrite stop it before it starts.
            </DialogDescription>
          </DialogHeader>
          {merge ? (
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-1 font-medium">
                This is a merge: take its changes against
              </legend>
              {parents.map((parent) => (
                <Choice
                  key={parent}
                  id={`${id}-parent-${String(parent)}`}
                  type="radio"
                  name={`${id}-parent`}
                  checked={mainline === parent}
                  onChange={() => {
                    setMainline(parent);
                  }}
                  label={parentLabel(parent)}
                />
              ))}
            </fieldset>
          ) : null}
          <div className="flex flex-col gap-2 text-sm">
            <Choice
              id={`${id}-no-commit`}
              type="checkbox"
              checked={noCommit}
              onChange={setNoCommit}
              label="Only stage the changes"
              detail="Review them and commit them yourself (--no-commit)."
            />
            {cherry ? (
              <Choice
                id={`${id}-origin`}
                type="checkbox"
                checked={recordOrigin}
                onChange={setRecordOrigin}
                label="Note where it came from"
                detail="Adds “(cherry picked from commit …)” to the message (-x)."
              />
            ) : null}
          </div>
          {pick.error ? <InlineError error={pick.error} /> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pick.isPending}>
              {pick.isPending ? (cherry ? "Cherry-picking…" : "Reverting…") : verb}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
