/** The commit list's columns as saved in Settings: order, visibility and widths. */
import type { DateDisplay, GraphColumn, GraphColumnId } from "@/shared/ipc/bindings";

/** Every column in its default order. The graph is always first. */
export const ALL_GRAPH_COLUMNS: readonly GraphColumnId[] = [
  "graph",
  "message",
  "author",
  "date",
  "commit",
];

export const GRAPH_COLUMN_TITLES: Record<GraphColumnId, string> = {
  graph: "Graph",
  message: "Message",
  author: "Author",
  date: "Date",
  commit: "Commit",
};

export const DATE_DISPLAY_OPTIONS: readonly { value: DateDisplay; label: string }[] = [
  { value: "absolute", label: "Date and time" },
  { value: "relative", label: "Time since (3 h ago)" },
];

/** Default widths. The graph's default fits its lanes; the message takes the rest. */
export const DEFAULT_COLUMN_WIDTHS: Partial<Record<GraphColumnId, number>> = {
  author: 160,
  date: 150,
  commit: 88,
};
export const MIN_COLUMN_WIDTH_PX = 48;
export const MAX_COLUMN_WIDTH_PX = 600;

export const DEFAULT_GRAPH_COLUMNS: readonly GraphColumn[] = ALL_GRAPH_COLUMNS.map((id) => ({
  id,
  visible: true,
  width: null,
}));

/** Whether a column's width can be changed (the message takes what is left). */
export const isResizable = (id: GraphColumnId): boolean => id !== "message";

/** Whether a column can be hidden (the message cannot). */
export const isHideable = (id: GraphColumnId): boolean => id !== "message";

/** A column's width in pixels, clamped; `auto` is the graph's width that fits its lanes. */
export function columnWidth(column: GraphColumn, auto = MIN_COLUMN_WIDTH_PX): number {
  const width = column.width ?? DEFAULT_COLUMN_WIDTHS[column.id];
  if (width === undefined) return auto;
  return Math.min(Math.max(width, MIN_COLUMN_WIDTH_PX), MAX_COLUMN_WIDTH_PX);
}

/**
 * The saved columns made consistent: known and unique, missing ones added at the end, the
 * graph first and the message shown.
 */
export function normalizeColumns(saved: readonly GraphColumn[]): GraphColumn[] {
  const seen = new Set<GraphColumnId>();
  const columns: GraphColumn[] = [];
  for (const column of [...saved, ...DEFAULT_GRAPH_COLUMNS]) {
    if (!ALL_GRAPH_COLUMNS.includes(column.id) || seen.has(column.id)) continue;
    seen.add(column.id);
    columns.push(column.id === "message" ? { ...column, visible: true } : column);
  }
  const graph = columns.filter((column) => column.id === "graph");
  return [...graph, ...columns.filter((column) => column.id !== "graph")];
}

/** `columns` with `moved` placed before `target`, or after it with `after`. */
export function moveColumn(
  columns: readonly GraphColumn[],
  moved: GraphColumnId,
  target: GraphColumnId,
  after: boolean,
): GraphColumn[] {
  const column = columns.find((each) => each.id === moved);
  if (!column || moved === target) return normalizeColumns(columns);
  const rest = columns.filter((each) => each.id !== moved);
  const index = rest.findIndex((each) => each.id === target) + (after ? 1 : 0);
  rest.splice(index, 0, column);
  return normalizeColumns(rest);
}

/** `columns` with `id` moved one place left (`-1`) or right (`1`), never before the graph. */
export function shiftColumn(
  columns: readonly GraphColumn[],
  id: GraphColumnId,
  step: -1 | 1,
): GraphColumn[] {
  const index = columns.findIndex((column) => column.id === id);
  const target = columns[index + step];
  if (index < 0 || !target) return normalizeColumns(columns);
  return moveColumn(columns, id, target.id, step === 1);
}

/** `columns` with `id` changed by `patch` (visibility or width). */
export function updateColumn(
  columns: readonly GraphColumn[],
  id: GraphColumnId,
  patch: Partial<Omit<GraphColumn, "id">>,
): GraphColumn[] {
  return normalizeColumns(
    columns.map((column) => (column.id === id ? { ...column, ...patch } : column)),
  );
}
