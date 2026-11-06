import { toast } from "sonner";

import type { RefTargetDto } from "@/shared/ipc/bindings";

import { useRenameBranch } from "../api/branches";
import { newNameProblem } from "../lib/names";
import { NameDialog } from "./NameDialog";
import { useRefNames } from "../hooks/useRefNames";

interface RenameBranchDialogProps {
  repoId: number;
  branch: RefTargetDto;
  onClose: () => void;
}

/** “Rename”: a new name for a local branch (its upstream and settings move with it). */
export function RenameBranchDialog({ repoId, branch, onClose }: RenameBranchDialogProps) {
  const names = useRefNames(repoId);
  const rename = useRenameBranch(repoId);
  // The branch's own name is free once it moves (`topic` can become `topic/old`).
  const others = new Set([...names.branches].filter((name) => name !== branch.name));
  return (
    <NameDialog
      title={`Rename ${branch.name}`}
      description="Its upstream and settings move to the new name. A copy already pushed keeps its old name on the remote."
      label="New name"
      initialName={branch.name}
      problemOf={(name) =>
        name === branch.name ? "Enter a different name." : newNameProblem(name, others, "branch")
      }
      submitLabel="Rename"
      pendingLabel="Renaming…"
      pending={rename.isPending}
      error={rename.error}
      onClose={onClose}
      onSubmit={(newName) => {
        rename.mutate(
          { branch, newName },
          {
            onSuccess: () => {
              toast.success(`Renamed ${branch.name} to ${newName}`);
              onClose();
            },
          },
        );
      }}
    />
  );
}
