/**
 * Patches and archives: counting the commits of a range, saving their patches, checking and
 * applying patch files, and saving an archive as a job. The check is keyed under the status,
 * which the watcher reads again on every change, so it follows the working tree.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { trackJob } from "@/features/jobs";
import { statusKeys } from "@/features/working-tree";
import type {
  ApplyModeDto,
  ArchiveRequestDto,
  PatchCommitsDto,
  SavePatchesRequestDto,
} from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

export const patchKeys = {
  count: (repoId: number, commits: PatchCommitsDto) =>
    ["patches", repoId, "count", commits.tip, commits.base] as const,
  check: (repoId: number, paths: readonly string[], mode: ApplyModeDto) =>
    [...statusKeys.all(repoId), "patches", mode, ...paths] as const,
};

/** How many commits get a patch; `enabled: false` while the base is being typed or empty. */
export function usePatchCount(repoId: number, commits: PatchCommitsDto, enabled: boolean) {
  return useQuery({
    queryKey: patchKeys.count(repoId, commits),
    queryFn: () => unwrap(commands.countPatches(repoId, commits)),
    enabled,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

/** Asks where, then saves; resolves to `null` when the user cancelled. */
export function useSavePatches(repoId: number) {
  return useMutation({
    mutationFn: (request: SavePatchesRequestDto) => unwrap(commands.savePatches(repoId, request)),
    meta: { silent: true, activity: "Saving patches" },
  });
}

/** What the chosen files hold and whether they apply; read again when the files change. */
export function usePatchCheck(repoId: number, paths: readonly string[], mode: ApplyModeDto) {
  return useQuery({
    queryKey: patchKeys.check(repoId, paths, mode),
    queryFn: () => unwrap(commands.checkPatches(repoId, [...paths], mode)),
    enabled: paths.length > 0,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

/** Applies the chosen files; the status is read again at once. */
export function useApplyPatches(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paths, mode }: { paths: readonly string[]; mode: ApplyModeDto }) =>
      unwrap(commands.applyPatches(repoId, [...paths], mode)),
    meta: { silent: true, activity: "Applying patches" },
    onSettled: () => queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) }),
  });
}

/**
 * Asks where, then starts the archive job (its toast follows it). Resolves to whether it
 * started: `false` when the user cancelled the save dialog.
 */
export async function startArchive(request: ArchiveRequestDto): Promise<boolean> {
  const id = await unwrap(commands.saveArchive(request));
  if (id === null) return false;
  // The toast starts once the file is chosen: before, there is nothing to follow.
  void trackJob(Promise.resolve(id), "archive");
  return true;
}
