/**
 * The Files module's rows while its filter box holds words: what the search found (matches and
 * the folders leading to them, all open), minus what is inside the folders closed since.
 */
import type { TreeSearchDto } from "@/shared/ipc/bindings";

import type { TreeRow } from "./rows";

const counts = new Intl.NumberFormat("en-US");

/** The rows of `found`, skipping the inside of the folders in `closed` (paths). */
export function searchRows(found: TreeSearchDto, closed: ReadonlySet<string>): TreeRow[] {
  const rows: TreeRow[] = [];
  /** Depth of the closed folder being skipped, if any. */
  let skipBelow: number | undefined;
  found.rows.forEach((row, index) => {
    if (skipBelow !== undefined && row.depth > skipBelow) return;
    skipBelow = undefined;
    const folder = row.entry.kind === "folder";
    const hasInside = (found.rows[index + 1]?.depth ?? -1) > row.depth;
    const open = folder && hasInside && !closed.has(row.path);
    if (folder && hasInside && !open) skipBelow = row.depth;
    rows.push({
      type: "entry",
      path: row.path,
      depth: row.depth,
      entry: row.entry,
      expanded: open,
      onTheWay: !row.matched,
    });
  });
  if (!found.complete) {
    rows.push({
      type: "note",
      path: "\0more",
      depth: 0,
      text: `Only the first ${counts.format(found.matches)} matches are shown; type more to narrow`,
    });
  }
  return rows;
}
