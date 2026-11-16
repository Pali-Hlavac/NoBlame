import { useState } from "react";

import { useSettledValue } from "@/shared/hooks/useSettledValue";

import { useTreeSearch } from "../api/tree";
import type { TreeRow } from "../lib/rows";
import { searchRows } from "../lib/searchRows";
import { useExpanded, useFilesStore, useFilter } from "../store/files";
import { useTreeRows } from "./useTreeRows";

/** How long the filter waits for typing to stop before searching, in milliseconds. */
const SEARCH_DELAY_MS = 150;

/** What the tree shows and how its folders open and close. */
export interface ShownRows {
  rows: TreeRow[];
  /** Opens or closes a folder: in the tree (kept per repository) or in the search result. */
  setOpen: (path: string, open: boolean) => void;
  /** The filter box holds words. */
  filtering: boolean;
  /** Searching: no result yet, or it failed. */
  searching: boolean;
  error: unknown;
}

/**
 * The rows of the Files module: the whole tree (folders opened by the user), or, while the
 * filter box holds words, what the search found in the whole tree, every folder open. Folders
 * closed in a search result are closed only there.
 */
export function useShownRows(repoId: number, rootId: string, repoPath: string): ShownRows {
  const expanded = useExpanded(repoPath);
  const tree = useTreeRows(repoId, rootId, expanded);
  const typed = useFilter(repoPath).trim();
  const query = useSettledValue(typed, SEARCH_DELAY_MS);
  const search = useTreeSearch(repoId, rootId, query);
  const [closed, setClosed] = useState<{ query: string; paths: ReadonlySet<string> }>({
    query,
    paths: new Set(),
  });
  // A new search starts with every folder open.
  const closedNow = closed.query === query ? closed.paths : new Set<string>();

  if (typed === "") {
    return {
      rows: tree,
      setOpen: (path, open) => {
        useFilesStore.getState().setExpanded(repoPath, path, open);
      },
      filtering: false,
      searching: false,
      error: null,
    };
  }
  return {
    rows: search.data ? searchRows(search.data, closedNow) : [],
    setOpen: (path, open) => {
      const paths = new Set(closedNow);
      if (open) paths.delete(path);
      else paths.add(path);
      setClosed({ query, paths });
    },
    filtering: true,
    searching: search.data === undefined || search.isPlaceholderData || query !== typed,
    error: search.error,
  };
}
