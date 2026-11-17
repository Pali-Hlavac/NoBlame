/** What a folder is before a repository is created or cloned there. */
import { useQuery } from "@tanstack/react-query";

import { commands, unwrap } from "@/shared/ipc/client";

/**
 * Whether `path` is missing, empty, holding files or a file, and the repository around it.
 * Read again on focus: the user may have changed the folder meanwhile.
 */
export function useFolderState(path: string) {
  return useQuery({
    queryKey: ["folder-state", path],
    queryFn: () => unwrap(commands.inspectFolder(path)),
    enabled: path.trim() !== "",
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
}
