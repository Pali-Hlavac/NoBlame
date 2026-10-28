/**
 * Turns the flat list of refs into the rows of the Branches module: a header per section
 * (local branches, one per remote, tags) followed by its refs, filtered and collapsible.
 */
import type { RefEntry } from "@/shared/ipc/bindings";

export interface SectionRow {
  type: "section";
  /** Stable id used to remember whether it is collapsed. */
  id: string;
  title: string;
  /** Refs in the section after filtering. */
  count: number;
  collapsed: boolean;
}

export interface RefRow {
  type: "ref";
  entry: RefEntry;
  /** Name shown in the row (remote branches without their remote). */
  display: string;
}

export type BranchRow = SectionRow | RefRow;

interface Section {
  id: string;
  title: string;
  refs: RefRow[];
}

function remoteOf(name: string): { remote: string; branch: string } {
  const slash = name.indexOf("/");
  return slash === -1
    ? { remote: name, branch: name }
    : { remote: name.slice(0, slash), branch: name.slice(slash + 1) };
}

/** Groups refs into sections in display order: local, each remote (by name), tags. */
function sectionsOf(entries: readonly RefEntry[]): Section[] {
  const local: Section = { id: "local", title: "Local branches", refs: [] };
  const tags: Section = { id: "tags", title: "Tags", refs: [] };
  const remotes = new Map<string, Section>();
  for (const entry of entries) {
    const { name, kind } = entry.label;
    if (kind === "branch") local.refs.push({ type: "ref", entry, display: name });
    else if (kind === "tag") tags.refs.push({ type: "ref", entry, display: name });
    else if (kind === "remote") {
      const { remote, branch } = remoteOf(name);
      let section = remotes.get(remote);
      if (!section) {
        section = { id: `remote:${remote}`, title: `Remote: ${remote}`, refs: [] };
        remotes.set(remote, section);
      }
      section.refs.push({ type: "ref", entry, display: branch });
    }
  }
  const sortedRemotes = [...remotes.values()].sort((a, b) => a.title.localeCompare(b.title));
  return [local, ...sortedRemotes, tags];
}

/**
 * Rows for the list. `filter` matches names case-insensitively; sections without matches are
 * hidden while filtering, and collapsed sections show only their header.
 */
export function buildRows(
  entries: readonly RefEntry[],
  filter: string,
  collapsed: ReadonlySet<string>,
): BranchRow[] {
  const needle = filter.trim().toLowerCase();
  const rows: BranchRow[] = [];
  for (const section of sectionsOf(entries)) {
    const refs = needle
      ? section.refs.filter((row) => row.entry.label.name.toLowerCase().includes(needle))
      : section.refs;
    if (needle && refs.length === 0) continue;
    const isCollapsed = collapsed.has(section.id);
    rows.push({
      type: "section",
      id: section.id,
      title: section.title,
      count: refs.length,
      collapsed: isCollapsed,
    });
    if (!isCollapsed) rows.push(...refs);
  }
  return rows;
}
