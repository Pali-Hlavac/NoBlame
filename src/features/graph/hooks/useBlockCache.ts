import { useState } from "react";
import { toast } from "sonner";

import { toIpcError } from "@/shared/ipc/client";

import { fetchGraphBlock } from "../api/graph";
import { BlockCache } from "../lib/blockCache";
import { BLOCK_CACHE_SIZE } from "../lib/constants";
import { decodeBlock } from "../lib/decode";

/**
 * The block cache of one repository plus a counter that changes whenever a block arrives, so
 * the canvas redraws. The cache itself is never part of React state.
 */
export function useBlockCache(repoId: number): { cache: BlockCache; version: number } {
  const [version, setVersion] = useState(0);
  const [cache] = useState(
    () =>
      new BlockCache(
        (block) => fetchGraphBlock(repoId, block),
        decodeBlock,
        BLOCK_CACHE_SIZE,
        () => {
          setVersion((current) => current + 1);
        },
        (error) => {
          const { message, hint } = toIpcError(error);
          toast.error(`Part of the graph could not be loaded: ${message}`, {
            description: hint ?? undefined,
          });
        },
      ),
  );
  return { cache, version };
}
