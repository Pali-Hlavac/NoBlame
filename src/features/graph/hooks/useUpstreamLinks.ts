import { useMemo } from "react";

import type { RefLabel } from "@/shared/ipc/bindings";

import { useRefs, useUpstreamList } from "../api/refs";
import { linkKey, upstreamLinks, type UpstreamLink } from "../lib/upstreamLinks";

/** The link of a label to its upstream (or to the branch tracking it), if any. */
export type LinkOf = (label: RefLabel) => UpstreamLink | undefined;

/** Links between local branches and their upstreams, from the refs and the upstreams read. */
export function useUpstreamLinks(repoId: number): LinkOf {
  const refs = useRefs(repoId).data;
  const upstreams = useUpstreamList(repoId).data;
  return useMemo(() => {
    const links =
      refs && upstreams ? upstreamLinks(refs, upstreams) : new Map<string, UpstreamLink>();
    return (label: RefLabel) => (links.size === 0 ? undefined : links.get(linkKey(label)));
  }, [refs, upstreams]);
}
