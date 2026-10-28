/**
 * Which text columns fit next to the graph. Docked panes can be narrow, so the optional columns
 * drop out one by one (commit, then author, then date) instead of squeezing the message away.
 */

export type OptionalColumn = "author" | "date" | "commit";

interface ColumnSpec {
  id: OptionalColumn;
  widthPx: number;
}

/** Optional columns in display order, with their widths. */
const OPTIONAL_COLUMNS: readonly ColumnSpec[] = [
  { id: "author", widthPx: 160 },
  { id: "date", widthPx: 150 },
  { id: "commit", widthPx: 88 },
];
/** Removed first when space runs out. */
const DROP_ORDER: readonly OptionalColumn[] = ["commit", "author", "date"];
/** The message keeps at least this much room before any optional column is shown. */
export const MIN_MESSAGE_WIDTH_PX = 240;
/** Gap between grid columns (`gap-3`) and right padding (`pr-3`). */
const GAP_PX = 12;

export interface ColumnLayout {
  /** CSS grid template: graph, message, then the visible optional columns. */
  template: string;
  visible: ReadonlySet<OptionalColumn>;
}

/** Picks the columns for a table `tableWidthPx` wide whose graph column is `graphWidthPx`. */
export function layoutColumns(tableWidthPx: number, graphWidthPx: number): ColumnLayout {
  const shown = new Set<OptionalColumn>(OPTIONAL_COLUMNS.map((column) => column.id));
  const needed = (): number =>
    graphWidthPx +
    GAP_PX * 2 +
    MIN_MESSAGE_WIDTH_PX +
    OPTIONAL_COLUMNS.filter((column) => shown.has(column.id)).reduce(
      (sum, column) => sum + column.widthPx + GAP_PX,
      0,
    );
  for (const id of DROP_ORDER) {
    if (needed() <= tableWidthPx) break;
    shown.delete(id);
  }
  const optional = OPTIONAL_COLUMNS.filter((column) => shown.has(column.id)).map(
    (column) => `${column.widthPx}px`,
  );
  return {
    template: [`${graphWidthPx}px`, "minmax(0,1fr)", ...optional].join(" "),
    visible: shown,
  };
}
