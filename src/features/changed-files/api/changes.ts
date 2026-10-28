/** The files a commit changed. */
import { useQuery } from "@tanstack/react-query";

import { graphKeys } from "@/features/graph";
import { commands, unwrap } from "@/shared/ipc/client";

/** Under the graph's keys: refetched when the graph reloads, dropped when the tab closes. */
export const changeKeys = {
  of: (repoId: number, row: number, parent: number) =>
    [...graphKeys.all(repoId), "changes", row, parent] as const,
};

/** Changed files of the commit on `row` against its parent number `parent` (0 = first). */
export function useChangedFiles(repoId: number, row: number, parent: number) {
  return useQuery({
    queryKey: changeKeys.of(repoId, row, parent),
    queryFn: () => unwrap(commands.getChangedFiles(repoId, row, parent)),
    staleTime: Infinity,
  });
}
