import { useQueries, useQueryClient } from "@tanstack/react-query";

import type { TreeListingDto } from "@/shared/ipc/bindings";

import { folderQuery } from "../api/tree";
import { buildRows, foldersToLoad, type Expanded, type FolderState } from "../lib/rows";

/**
 * The rows of the tree whose root folder is `rootId`, loading every open folder on the way.
 * Which folders to read follows from what is cached: when a folder arrives, the next render
 * finds the open folders inside it. Listings are keyed by folder id, so folders the next
 * commit did not change show at once.
 */
export function useTreeRows(repoId: number, rootId: string, expanded: Expanded) {
  const client = useQueryClient();
  const ids = foldersToLoad(rootId, expanded, (treeId) =>
    client.getQueryData<TreeListingDto>(folderQuery(repoId, treeId).queryKey),
  );
  const results = useQueries({ queries: ids.map((treeId) => folderQuery(repoId, treeId)) });
  const states = new Map<string, FolderState>(
    ids.map((treeId, index) => [
      treeId,
      { data: results[index]?.data, error: results[index]?.error ?? undefined },
    ]),
  );
  return buildRows(rootId, expanded, (treeId) => states.get(treeId));
}
