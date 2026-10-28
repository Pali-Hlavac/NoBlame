import { useMemo, useState } from "react";

import { fetchAncestryBlock } from "../api/graph";
import { BlockCache } from "../lib/blockCache";
import { ANCESTRY_CACHE_SIZE } from "../lib/constants";
import { decodeAncestryBlock, type AncestryBlock } from "../lib/decodeAncestry";

/**
 * Highlight overlays for the history of the commit on `row` (none when `row` is undefined).
 * A new selection starts a new cache; `version` changes when an overlay arrives.
 */
export function useAncestryCache(
  repoId: number,
  row: number | undefined,
): { cache: BlockCache<AncestryBlock> | undefined; version: number } {
  const [version, setVersion] = useState(0);
  const cache = useMemo(
    () =>
      row === undefined
        ? undefined
        : new BlockCache(
            (block) => fetchAncestryBlock(repoId, row, block),
            decodeAncestryBlock,
            ANCESTRY_CACHE_SIZE,
            () => {
              setVersion((current) => current + 1);
            },
            // Highlighting is a hint: a failure leaves the graph as it is, without a toast.
            (error) => {
              console.warn("Highlighting the history failed", error);
            },
          ),
    [repoId, row],
  );
  return { cache, version };
}
