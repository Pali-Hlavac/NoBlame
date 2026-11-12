/** The working tree status of an open repository, and its files as git would store them. */
import { useQuery } from "@tanstack/react-query";

import type { WorkingTreeStatusDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { statusScope } from "../lib/scope";

/** Everything under `all(repoId)` is read again when the working tree changes. */
export const statusKeys = {
  all: (repoId: number) => ["status", repoId] as const,
  status: (repoId: number) => ["status", repoId, "status"] as const,
  file: (repoId: number, path: string) => ["status", repoId, "file", path] as const,
};

/** One `git status` read, shared by the counts and the file lists. */
function statusQuery(repoId: number, enabled: boolean) {
  return {
    queryKey: statusKeys.status(repoId),
    queryFn: () => unwrap(commands.getStatus(repoId, statusScope())),
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: "always" as const,
  };
}

/** Reads the status once, outside React (a task window choosing its file before it renders). */
export function fetchStatus(repoId: number): Promise<WorkingTreeStatusDto | null> {
  return unwrap(commands.getStatus(repoId, statusScope()));
}

/**
 * The status: counts, staged files and unstaged ones (`null` for a bare repository). The
 * working tree changes outside the app, so it is read again when the window regains focus and
 * when the file watcher reports a change.
 */
export function useWorkingTreeStatus(repoId: number, enabled = true) {
  return useQuery(statusQuery(repoId, enabled));
}

/** Staged, changed, untracked and conflicted counts (`null` for a bare repository). */
export function useStatusSummary(repoId: number, enabled = true) {
  return useQuery({
    ...statusQuery(repoId, enabled),
    select: (status: WorkingTreeStatusDto | null) => status?.summary ?? null,
  });
}

/**
 * The id the working tree file at `path` would have as a blob (`null` when it is gone). Diffs
 * and previews of the file are keyed by it, so they change exactly when its contents do.
 */
export function useWorktreeFileId(repoId: number, path: string, enabled = true) {
  return useQuery({
    queryKey: statusKeys.file(repoId, path),
    queryFn: () => unwrap(commands.getWorktreeFileId(repoId, path)),
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
}
