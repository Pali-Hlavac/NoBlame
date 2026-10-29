/** Raw file contents, for previews (images). */
import { useQuery } from "@tanstack/react-query";

import { toArrayBuffer } from "@/shared/ipc/bytes";
import { commands, unwrap } from "@/shared/ipc/client";

/** Previews out of view are dropped quickly: images can be large. */
const CONTENTS_GC_TIME_MS = 30_000;

/** The contents of blob `blobId` (none when `null`); the backend refuses files over 32 MB. */
export function useFileContents(repoId: number, blobId: string | null) {
  return useQuery({
    queryKey: ["contents", repoId, blobId],
    queryFn: async () =>
      toArrayBuffer(await unwrap(commands.getFileContents(repoId, blobId ?? ""))),
    enabled: blobId !== null,
    staleTime: Infinity,
    gcTime: CONTENTS_GC_TIME_MS,
  });
}
