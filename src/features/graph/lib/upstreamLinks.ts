/**
 * Links between a local branch and its upstream for the graph's labels, as Git Extensions
 * draws them: when the two point at different commits, each label gets an arrow to the other's
 * commit (up when it is newer in the list, down when older).
 */
import type { RefEntry, RefLabel, UpstreamDto } from "@/shared/ipc/bindings";

/** Where a label's arrow leads. */
export interface UpstreamLink {
  /** The other reference's short name (`origin/main`, or `main` from its upstream). */
  name: string;
  /** Its commit's graph row. */
  row: number;
  /** The local branch's upstream (true), or the local branch tracking this one (false). */
  toUpstream: boolean;
}

/** Key of a label in the links: its kind and name. */
export function linkKey(label: Pick<RefLabel, "kind" | "name">): string {
  return `${label.kind}:${label.name}`;
}

const REMOTES = "refs/remotes/";
const HEADS = "refs/heads/";

/** The kind and short name of an upstream's full name, if it is a branch. */
function upstreamLabel(full: string): Pick<RefLabel, "kind" | "name"> | undefined {
  if (full.startsWith(REMOTES)) return { kind: "remote", name: full.slice(REMOTES.length) };
  if (full.startsWith(HEADS)) return { kind: "branch", name: full.slice(HEADS.length) };
  return undefined;
}

/**
 * Links by label key ({@link linkKey}). Only pairs at different commits, both in the graph, get
 * one; a remote branch several local branches track links to the first.
 */
export function upstreamLinks(
  refs: readonly RefEntry[],
  upstreams: readonly UpstreamDto[],
): Map<string, UpstreamLink> {
  const byKey = new Map(refs.map((ref) => [linkKey(ref.label), ref]));
  const links = new Map<string, UpstreamLink>();
  for (const upstream of upstreams) {
    if (upstream.gone) continue;
    const target = upstreamLabel(upstream.upstream);
    const local = byKey.get(linkKey({ kind: "branch", name: upstream.branch }));
    const other = target ? byKey.get(linkKey(target)) : undefined;
    if (!local || !other || local.target === other.target) continue;
    if (local.row === null || other.row === null) continue;
    links.set(linkKey(local.label), { name: other.label.name, row: other.row, toUpstream: true });
    const back = linkKey(other.label);
    if (!links.has(back)) {
      links.set(back, { name: local.label.name, row: local.row, toUpstream: false });
    }
  }
  return links;
}
