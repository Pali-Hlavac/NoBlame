/** The files of a revision: the entry at a path in a commit, and the entries of a folder. */
import { queryOptions, useQuery } from "@tanstack/react-query";

import { graphKeys } from "@/features/graph";
import { commands, unwrap } from "@/shared/ipc/client";

export const treeKeys = {
  /** Under the graph's keys: rows change meaning when the graph reloads. */
  entry: (repoId: number, row: number, path: string) =>
    [...graphKeys.all(repoId), "tree-entry", row, path] as const,
  /** Keyed by the folder's id, which names its contents: a listing never changes. */
  folder: (repoId: number, treeId: string) => ["tree", repoId, treeId] as const,
};

/** The entry at `path` in the commit on `row` (`""` is the root folder); `null` if absent. */
export function useTreeEntry(repoId: number, row: number, path: string | undefined) {
  return useQuery({
    queryKey: treeKeys.entry(repoId, row, path ?? ""),
    queryFn: () => unwrap(commands.getTreeEntry(repoId, row, path ?? "")),
    enabled: path !== undefined,
    staleTime: Infinity,
  });
}

/** The query of the entries of folder `treeId`. */
export function folderQuery(repoId: number, treeId: string) {
  return queryOptions({
    queryKey: treeKeys.folder(repoId, treeId),
    queryFn: () => unwrap(commands.listTree(repoId, treeId)),
    staleTime: Infinity,
  });
}
