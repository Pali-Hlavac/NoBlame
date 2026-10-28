/**
 * Rows as the list shows them: the working tree rows first (when there are any), then one row
 * per commit. A "display index" counts both; graph rows count commits only.
 */
import type { Selection } from "@/features/selection";
import type { WorkingTreeRow } from "@/features/working-tree";

export interface DisplayRows {
  /** Working tree rows above the commits. */
  artificial: readonly WorkingTreeRow[];
  /** Number of artificial rows: display index = graph row + offset. */
  offset: number;
  /** All rows. */
  count: number;
}

export function displayRows(artificial: readonly WorkingTreeRow[], commits: number): DisplayRows {
  return { artificial, offset: artificial.length, count: artificial.length + commits };
}

/** The display index of `selection`, or undefined when it is not shown (a row went away). */
export function indexOfSelection(
  rows: DisplayRows,
  selection: Selection | undefined,
): number | undefined {
  if (!selection) return undefined;
  if (selection.kind === "commit") return selection.row + rows.offset;
  const index = rows.artificial.findIndex((row) => row.kind === selection.kind);
  return index < 0 ? undefined : index;
}

/** What the row at `index` selects. */
export function selectionAt(rows: DisplayRows, index: number): Selection | undefined {
  if (index < 0 || index >= rows.count) return undefined;
  const artificial = rows.artificial[index];
  if (artificial) return { kind: artificial.kind };
  return { kind: "commit", row: index - rows.offset };
}
