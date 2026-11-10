/**
 * The reflog of HEAD or a local branch. It is keyed under the repository's references, so it is
 * read again whenever the file watcher reports that they changed.
 */
import { useQuery } from "@tanstack/react-query";

import { refKeys } from "@/features/graph";
import { commands, unwrap } from "@/shared/ipc/client";

/** The reflog of `reference` (`HEAD` or `refs/heads/<name>`), newest first. */
export function useReflog(repoId: number, reference: string) {
  return useQuery({
    queryKey: [...refKeys.all(repoId), "reflog", reference],
    queryFn: () => unwrap(commands.getReflog(repoId, reference)),
    placeholderData: (previous, query) =>
      query?.queryKey[query.queryKey.length - 1] === reference ? previous : undefined,
  });
}
