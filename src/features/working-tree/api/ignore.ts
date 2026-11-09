/** Ignoring untracked files: what a pattern would hide, and adding it to an ignore file. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { IgnoreRequestDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { statusKeys } from "./status";

/**
 * The untracked files listed now that `pattern` would hide. Under the status keys, so it is read
 * again when the files change; the last answer stays while the next pattern is checked.
 */
export function useIgnorePreview(repoId: number, pattern: string, enabled: boolean) {
  return useQuery({
    queryKey: [...statusKeys.all(repoId), "ignore-preview", pattern] as const,
    queryFn: () => unwrap(commands.previewIgnore(repoId, pattern)),
    enabled,
    staleTime: 0,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

/** Adds a pattern to `.gitignore` or `.git/info/exclude`; resolves `false` if it was there. */
export function useIgnoreFiles(repoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: IgnoreRequestDto) => unwrap(commands.ignoreFiles(repoId, request)),
    meta: { activity: "Ignoring files" },
    // `info/exclude` is inside `.git`, which the file watcher does not report as a change.
    onSettled: () => queryClient.invalidateQueries({ queryKey: statusKeys.all(repoId) }),
  });
}
