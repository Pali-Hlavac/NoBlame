import { useState } from "react";
import { toast } from "sonner";

import { useCreateBranch } from "../api/branches";
import { newNameProblem } from "../lib/names";
import type { StartPoint } from "../store/dialog";
import { DialogCheckbox, NameDialog } from "./NameDialog";
import { useRefNames } from "../hooks/useRefNames";
import { actionDone } from "@/shared/lib/actionDone";

interface CreateBranchDialogProps {
  repoId: number;
  start: StartPoint;
  /** A remote branch checked out as a local one: named after it, tracking it, checked out. */
  remote?: boolean;
  initialName?: string;
  onClose: () => void;
}

/** “Create a branch here” (and “Check out as a new local branch” for remote branches). */
export function CreateBranchDialog(props: CreateBranchDialogProps) {
  const { repoId, start, remote = false } = props;
  const names = useRefNames(repoId);
  const create = useCreateBranch(repoId);
  const [checkout, setCheckout] = useState(true);
  return (
    <NameDialog
      title={remote ? `Check out ${start.label}` : "Create a branch"}
      description={
        remote ? (
          <>
            A new local branch is made at {start.label} and checked out. It tracks {start.label}, so
            pulling and pushing go there.
          </>
        ) : (
          <>Starts at {start.label}.</>
        )
      }
      label="Branch name"
      initialName={props.initialName ?? ""}
      checkInitialName={remote}
      problemOf={(name) => newNameProblem(name, names.branches, "branch")}
      submitLabel={remote || checkout ? "Create and check out" : "Create"}
      pendingLabel="Creating…"
      pending={create.isPending}
      error={create.error}
      onClose={props.onClose}
      onSubmit={(name) => {
        const andCheckout = remote || checkout;
        create.mutate(
          { name, start: start.revision, checkout: andCheckout, track: remote },
          {
            onSuccess: () => {
              toast.success(andCheckout ? `Switched to the new branch ${name}` : `Created ${name}`);
              if (andCheckout) actionDone("switch");
              props.onClose();
            },
          },
        );
      }}
    >
      {!remote && (
        <DialogCheckbox checked={checkout} onChange={setCheckout}>
          Check out the new branch
        </DialogCheckbox>
      )}
    </NameDialog>
  );
}
