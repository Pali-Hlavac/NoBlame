/**
 * The commit list's grid: the columns chosen in Settings, in their order and widths. Docked
 * panes can be narrow, so the author, date and commit columns drop out one by one (commit,
 * then author, then date) instead of squeezing the message away.
 */
import { columnWidth } from "@/features/settings";
import type { GraphColumn, GraphColumnId } from "@/shared/ipc/bindings";

/** Removed first when space runs out. */
const DROP_ORDER: readonly GraphColumnId[] = ["commit", "author", "date"];
/** The message keeps at least this much room before an optional column is shown. */
export const MIN_MESSAGE_WIDTH_PX = 240;
/** Gap between grid columns (`gap-3`) and right padding (`pr-3`). */
export const GAP_PX = 12;

export interface ColumnCell {
  id: GraphColumnId;
  /** Width in pixels; `null` for the message, which takes the rest. */
  widthPx: number | null;
}

export interface ColumnLayout {
  /** CSS grid template of the cells. */
  template: string;
  /** Shown columns in order. The graph is always the first cell (0 px wide when hidden). */
  cells: readonly ColumnCell[];
  /** Width of the graph canvas; 0 when the graph is hidden. */
  graphWidthPx: number;
}

/**
 * Lays out `columns` in a table `tableWidthPx` wide. `autoGraphWidthPx` fits the graph's lanes
 * and is used unless the graph column was given a width.
 */
export function layoutColumns(
  tableWidthPx: number,
  autoGraphWidthPx: number,
  columns: readonly GraphColumn[],
): ColumnLayout {
  let cells: ColumnCell[] = columns
    .filter((column) => column.visible || column.id === "graph")
    .map((column) => ({
      id: column.id,
      widthPx:
        column.id === "message" ? null : column.visible ? columnWidth(column, autoGraphWidthPx) : 0,
    }));
  const needed = (): number =>
    cells.reduce((sum, cell) => sum + (cell.widthPx ?? MIN_MESSAGE_WIDTH_PX) + GAP_PX, 0);
  for (const id of DROP_ORDER) {
    if (needed() <= tableWidthPx) break;
    cells = cells.filter((cell) => cell.id !== id);
  }
  const template = cells
    .map((cell) => (cell.widthPx === null ? "minmax(0,1fr)" : `${cell.widthPx}px`))
    .join(" ");
  return { template, cells, graphWidthPx: cells[0]?.widthPx ?? 0 };
}
