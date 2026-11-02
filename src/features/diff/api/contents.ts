/** Raw file contents, for previews (images). */
import { useQuery } from "@tanstack/react-query";

import { toArrayBuffer } from "@/shared/ipc/bytes";
import { commands, unwrap } from "@/shared/ipc/client";

/** Previews out of view are dropped quickly: images can be large. */
const CONTENTS_GC_TIME_MS = 30_000;

/**
 * The contents of blob `blobId` (none when `null`), or of the working tree file at
 * `worktreePath` whose id is `blobId`; the backend refuses files over 32 MB.
 */
export function useFileContents(repoId: number, blobId: string | null, worktreePath?: string) {
  return useQuery({
    queryKey: ["contents", repoId, blobId, worktreePath ?? null],
    queryFn: async () =>
      toArrayBuffer(
        await unwrap(
          worktreePath === undefined
            ? commands.getFileContents(repoId, blobId ?? "")
            : commands.getWorktreeFileContents(repoId, worktreePath, blobId ?? ""),
        ),
      ),
    enabled: blobId !== null,
    staleTime: Infinity,
    gcTime: CONTENTS_GC_TIME_MS,
  });
}
