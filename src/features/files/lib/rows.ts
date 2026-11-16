/**
 * The Files module's tree as a flat list of rows: the root folder's entries, with the entries of
 * every open folder right below it. Folders are read one at a time, so a folder that is still
 * loading (or failed) shows a note row instead of its entries.
 */
import type { TreeEntryDto, TreeListingDto } from "@/shared/ipc/bindings";

/** A folder's listing as far as it is known. */
export interface FolderState {
  data?: TreeListingDto;
  error?: unknown;
}

export type TreeRow =
  | {
      type: "entry";
      /** Path from the root, `/`-separated. */
      path: string;
      depth: number;
      entry: TreeEntryDto;
      /** An open folder (its entries follow). */
      expanded: boolean;
      /** Searching: a folder shown only because something in it matched. */
      onTheWay?: boolean;
    }
  | {
      type: "note";
      /** Unique key (never a real path: Git names cannot contain NUL). */
      path: string;
      depth: number;
      text: string;
      error?: unknown;
    };

/** Open folders by path. */
export type Expanded = Readonly<Record<string, true>>;

const counts = new Intl.NumberFormat("en-US");

/** `parent/name`, or `name` at the root. */
export function childPath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

/** The folder containing `path` (`""` for the root). */
export function parentPath(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

/**
 * The folders whose entries the rows need, as far as `listing` (what is loaded) shows: the root,
 * then every open folder whose parent is open and loaded. Each id once.
 */
export function foldersToLoad(
  rootId: string,
  expanded: Expanded,
  listing: (treeId: string) => TreeListingDto | undefined,
): string[] {
  const ids = new Set([rootId]);
  const visit = (treeId: string, parent: string): void => {
    for (const entry of listing(treeId)?.entries ?? []) {
      const path = childPath(parent, entry.name);
      if (entry.kind === "folder" && expanded[path]) {
        ids.add(entry.id);
        visit(entry.id, path);
      }
    }
  };
  visit(rootId, "");
  return [...ids];
}

/** The rows of the tree whose root folder is `rootId`. */
export function buildRows(
  rootId: string,
  expanded: Expanded,
  folder: (treeId: string) => FolderState | undefined,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const add = (treeId: string, parent: string, depth: number): void => {
    const state = folder(treeId);
    if (!state?.data) {
      rows.push(
        state?.error === undefined
          ? { type: "note", path: `${parent}\0loading`, depth, text: "Loading…" }
          : {
              type: "note",
              path: `${parent}\0error`,
              depth,
              text: "Could not read this folder",
              error: state.error,
            },
      );
      return;
    }
    for (const entry of state.data.entries) {
      const path = childPath(parent, entry.name);
      const open = entry.kind === "folder" && expanded[path] === true;
      rows.push({ type: "entry", path, depth, entry, expanded: open });
      if (open) add(entry.id, path, depth + 1);
    }
    const hidden = state.data.total - state.data.entries.length;
    if (hidden > 0) {
      rows.push({
        type: "note",
        path: `${parent}\0more`,
        depth,
        text: `${counts.format(hidden)} more not shown`,
      });
    }
  };
  add(rootId, "", 0);
  return rows;
}

/** Index of the row of the folder containing row `index`, if it is shown. */
export function parentRow(rows: readonly TreeRow[], index: number): number | undefined {
  const depth = rows[index]?.depth ?? 0;
  for (let at = index - 1; at >= 0; at--) {
    if ((rows[at]?.depth ?? 0) < depth) return at;
  }
  return undefined;
}

/** Accessible text of a row, e.g. "main.rs, file" or "src, folder, open". */
export function describeRow(row: TreeRow): string {
  if (row.type === "note") return row.text;
  const { entry } = row;
  const kind = KIND_WORDS[entry.kind];
  return row.expanded ? `${entry.name}, ${kind}, open` : `${entry.name}, ${kind}`;
}

const KIND_WORDS: Readonly<Record<TreeEntryDto["kind"], string>> = {
  folder: "folder",
  file: "file",
  executable: "executable file",
  symlink: "symbolic link",
  submodule: "submodule",
};
