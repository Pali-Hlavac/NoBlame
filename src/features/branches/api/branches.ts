/**
 * Checking out, and creating, renaming and deleting branches and tags. The file watcher reports
 * the changed refs, which reloads the graph and the Branches module; the status is read again
 * at once (a checkout changes the working tree).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { graphKeys } from "@/features/graph";
import { statusKeys } from "@/features/working-tree";
import type {
  CreateBranchRequestDto,
  CreateTagRequestDto,
  RefTargetDto,
  RenameBranchRequestDto,
} from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

/** Under the graph's keys, so they are dropped when the repository closes. */
export const branchKeys = {
  unique: (repoId: number, reference: RefTargetDto) =>
    [
      ...graphKeys.all(repoId),
      "unique",
      reference.namespace,
      reference.name,
      reference.target,
    ] as const,
};

function useRefresh(repoId: number) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) });
}

/** The commits only `reference` holds, counted when the delete confirmation opens. */
export function useUniqueCommits(repoId: number, reference: RefTargetDto | null) {
  return useQuery({
    queryKey: reference
      ? branchKeys.unique(repoId, reference)
      : [...graphKeys.all(repoId), "unique"],
    queryFn: () => {
      if (!reference) throw new Error("no reference to count");
      return unwrap(commands.getUniqueCommits(repoId, reference));
    },
    enabled: reference !== null,
    staleTime: 0,
    gcTime: 0,
  });
}

/** Checks out a local branch. Errors are shown by the caller (with git's words). */
export function useCheckoutBranch(repoId: number) {
  const refresh = useRefresh(repoId);
  return useMutation({
    mutationFn: (name: string) => unwrap(commands.checkoutBranch(repoId, name)),
    meta: { silent: true, activity: "Checking out the branch" },
    onSettled: refresh,
  });
}

/** Checks out a commit without a branch. */
export function useCheckoutCommit(repoId: number) {
  const refresh = useRefresh(repoId);
  return useMutation({
    mutationFn: (commit: string) => unwrap(commands.checkoutCommit(repoId, commit)),
    meta: { silent: true, activity: "Checking out the commit" },
    onSettled: refresh,
  });
}

/** Creates a branch (and checks it out when asked). */
export function useCreateBranch(repoId: number) {
  const refresh = useRefresh(repoId);
  return useMutation({
    mutationFn: (request: CreateBranchRequestDto) => unwrap(commands.createBranch(repoId, request)),
    meta: { silent: true, activity: "Creating the branch" },
    onSettled: refresh,
  });
}

/** Renames a branch. */
export function useRenameBranch(repoId: number) {
  return useMutation({
    mutationFn: (request: RenameBranchRequestDto) => unwrap(commands.renameBranch(repoId, request)),
    meta: { silent: true, activity: "Renaming the branch" },
  });
}

/** Deletes a local branch or a tag. */
export function useDeleteRef(repoId: number) {
  return useMutation({
    mutationFn: (reference: RefTargetDto) => unwrap(commands.deleteRef(repoId, reference)),
    meta: { silent: true, activity: "Deleting" },
  });
}

/** Creates a tag. */
export function useCreateTag(repoId: number) {
  return useMutation({
    mutationFn: (request: CreateTagRequestDto) => unwrap(commands.createTag(repoId, request)),
    meta: { silent: true, activity: "Creating the tag" },
  });
}
