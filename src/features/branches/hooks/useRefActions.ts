import { useMemo } from "react";
import { toast } from "sonner";

import type { RefActions } from "@/features/graph";
import {
  openInteractive,
  openMerge,
  openPick,
  openRebase,
  openReset,
  useBisectActions,
} from "@/features/operations";
import { openArchive, openCreatePatches } from "@/features/patches";
import { useActiveRepository } from "@/features/repositories";
import { toIpcError } from "@/shared/ipc/client";

import { useCheckoutBranch } from "../api/branches";
import { openBranchDialog } from "../store/dialog";

/**
 * Branch and tag actions for one repository: checking out a local branch runs at once (a toast
 * tells how it went, with git's words when it refused); the rest open their dialog.
 */
export function useRefActions(repoId: number): RefActions {
  const checkout = useCheckoutBranch(repoId);
  const { mutate } = checkout;
  const bisect = useBisectActions(repoId);
  const active = useActiveRepository().summary;
  // Archives run as jobs, which open the repository by its folder.
  const path = active?.id === repoId ? active.path : undefined;
  return useMemo(
    () => ({
      checkoutBranch: (name) => {
        const id = toast.loading(`Checking out ${name}…`);
        mutate(name, {
          onSuccess: () => toast.success(`Switched to ${name}`, { id }),
          onError: (error) => {
            const { message, hint } = toIpcError(error);
            toast.error(`Could not check out ${name}`, {
              id,
              description: hint ? `${message}\n\n${hint}` : message,
              // git's message comes in lines; keep them.
              classNames: { description: "whitespace-pre-line" },
            });
          },
        });
      },
      checkoutCommit: (commit) => {
        openBranchDialog({ kind: "checkout-commit", repoId, commit });
      },
      checkoutRemote: (remote) => {
        openBranchDialog({ kind: "checkout-remote", repoId, remote });
      },
      createBranch: (start) => {
        openBranchDialog({ kind: "create-branch", repoId, start });
      },
      createTag: (start) => {
        openBranchDialog({ kind: "create-tag", repoId, start });
      },
      renameBranch: (branch) => {
        openBranchDialog({ kind: "rename-branch", repoId, branch });
      },
      pushBranch: (branch) => {
        openBranchDialog({ kind: "push-branch", repoId, branch });
      },
      pushTag: (tag) => {
        openBranchDialog({ kind: "push-tag", repoId, tag });
      },
      deleteOnRemote: (reference) => {
        openBranchDialog({ kind: "delete-on-remote", repoId, reference });
      },
      deleteRef: (reference) => {
        openBranchDialog({ kind: "delete", repoId, reference });
      },
      merge: (source) => {
        openMerge(repoId, source);
      },
      cherryPick: (commit) => {
        openPick(repoId, "cherryPick", commit);
      },
      revert: (commit) => {
        openPick(repoId, "revert", commit);
      },
      rebase: (onto) => {
        openRebase(repoId, onto);
      },
      interactiveRebase: (from) => {
        openInteractive(repoId, from);
      },
      reset: (commit, options) => {
        openReset(repoId, commit, options?.restore === true);
      },
      bisect,
      createPatches: (commit) => {
        openCreatePatches(repoId, commit);
      },
      saveArchive: (commit, name) => {
        if (path) openArchive(repoId, path, commit, name);
      },
    }),
    [bisect, mutate, path, repoId],
  );
}
