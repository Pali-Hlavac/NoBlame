/** Details of one commit, read from the session's graph. */
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { graphKeys } from "@/features/graph";
import { commands, unwrap } from "@/shared/ipc/client";

/** Under the graph's keys, so closing the repository forgets them too. */
export const detailsKeys = {
  row: (repoId: number, row: number) => [...graphKeys.all(repoId), "details", row] as const,
};

/** Details of the commit on `row` (history does not change while the session is open). */
export function useCommitDetails(repoId: number, row: number | undefined) {
  return useQuery({
    queryKey: detailsKeys.row(repoId, row ?? -1),
    queryFn: () => unwrap(commands.getCommitDetails(repoId, row ?? 0)),
    enabled: row !== undefined,
    staleTime: Infinity,
    // Keep showing the previous commit while the next one loads (arrow-key browsing).
    placeholderData: keepPreviousData,
  });
}
