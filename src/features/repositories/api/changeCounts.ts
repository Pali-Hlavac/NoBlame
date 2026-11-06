/**
 * Uncommitted files of a repository, counted once each as new, changed or deleted (the numbers
 * beside a repository in the Repositories module).
 */
import { skipToken, useQuery } from "@tanstack/react-query";

import { useStatusSummary } from "@/features/working-tree";
import type { ChangeCountsDto, RepoSummary } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { sessionKeys } from "./session";

/**
 * A closed repository is counted again on window focus when its counts are older than this:
 * switching windows back and forth does not run `git status` in every repository each time.
 */
const CLOSED_COUNTS_STALE_MS = 15_000;

export const changeCountKeys = {
  all: ["change-counts"] as const,
  byPath: (path: string) => ["change-counts", path] as const,
};

/**
 * The counts of the repository at `path` (`null` for a bare repository, `undefined` while
 * unknown). An open repository (`sessionPath`, the path its tab opened) uses its session's
 * status, which the file watcher keeps current; a closed one, or a restored tab not shown yet
 * (it has no session until it renders), runs `git status` through `get_change_counts`, again
 * when the window regains focus.
 */
export function useChangeCounts(
  path: string,
  sessionPath: string | undefined,
  enabled: boolean,
): ChangeCountsDto | null | undefined {
  // Read from the cache only (`skipToken`): opening sessions is the tab's job.
  const session = useQuery<RepoSummary>({
    queryKey: sessionKeys.byPath(sessionPath ?? ""),
    queryFn: skipToken,
    enabled: enabled && sessionPath !== undefined,
  });
  const repoId = sessionPath === undefined ? undefined : session.data?.id;
  const open = useStatusSummary(repoId ?? -1, enabled && repoId !== undefined);
  const closed = useQuery({
    queryKey: changeCountKeys.byPath(path),
    queryFn: () => unwrap(commands.getChangeCounts(path)),
    enabled: enabled && repoId === undefined,
    staleTime: CLOSED_COUNTS_STALE_MS,
    refetchOnWindowFocus: true,
    // An untrusted or broken repository simply shows no counts.
    retry: false,
  });
  if (!enabled) return undefined;
  if (repoId === undefined || open.data === undefined) return closed.data;
  return open.data?.changes ?? null;
}
