/** The files of a revision: the entry at a path in a commit, and the entries of a folder. */
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import { graphKeys } from "@/features/graph";
import { commands, unwrap } from "@/shared/ipc/client";

export const treeKeys = {
  /** Under the graph's keys: rows change meaning when the graph reloads. */
  entry: (repoId: number, row: number, path: string) =>
    [...graphKeys.all(repoId), "tree-entry", row, path] as const,
  /** Keyed by the folder's id, which names its contents: a listing never changes. */
  folder: (repoId: number, treeId: string) => ["tree", repoId, treeId] as const,
  /** A tree's contents never change, so neither does a search in it. */
  search: (repoId: number, treeId: string, query: string) =>
    ["tree", repoId, treeId, "search", query] as const,
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

/**
 * The entries below folder `treeId` whose path holds every word of `query`, with the folders
 * leading to them (off while the query is empty).
 */
export function useTreeSearch(repoId: number, treeId: string, query: string) {
  return useQuery({
    queryKey: treeKeys.search(repoId, treeId, query),
    queryFn: () => unwrap(commands.searchTree(repoId, treeId, query)),
    enabled: query.trim() !== "",
    staleTime: Infinity,
    // Keep the last result while the next one is read (typing).
    placeholderData: keepPreviousData,
  });
}
