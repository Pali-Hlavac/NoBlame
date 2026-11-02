import type { GraphColumn } from "@/shared/ipc/bindings";

import {
  DEFAULT_GRAPH_COLUMNS,
  MAX_COLUMN_WIDTH_PX,
  columnWidth,
  moveColumn,
  normalizeColumns,
  shiftColumn,
  updateColumn,
} from "./graphColumns";

const ids = (columns: readonly GraphColumn[]) => columns.map((column) => column.id);

describe("graph columns", () => {
  it("keeps the graph first, the message shown and every column once", () => {
    const saved: GraphColumn[] = [
      { id: "date", visible: true, width: 90 },
      { id: "message", visible: false, width: null },
      { id: "graph", visible: false, width: null },
      { id: "date", visible: false, width: null },
    ];
    const columns = normalizeColumns(saved);
    expect(ids(columns)).toEqual(["graph", "date", "message", "author", "commit"]);
    expect(columns.find((column) => column.id === "message")?.visible).toBe(true);
    expect(columns.find((column) => column.id === "graph")?.visible).toBe(false);
    expect(columns.find((column) => column.id === "date")?.width).toBe(90);
  });

  it("moves a column before or after another, never before the graph", () => {
    expect(ids(moveColumn(DEFAULT_GRAPH_COLUMNS, "commit", "message", false))).toEqual([
      "graph",
      "commit",
      "message",
      "author",
      "date",
    ]);
    expect(ids(moveColumn(DEFAULT_GRAPH_COLUMNS, "author", "date", true))).toEqual([
      "graph",
      "message",
      "date",
      "author",
      "commit",
    ]);
    expect(ids(moveColumn(DEFAULT_GRAPH_COLUMNS, "date", "graph", false))[0]).toBe("graph");
    expect(ids(shiftColumn(DEFAULT_GRAPH_COLUMNS, "message", -1))).toEqual(
      ids(DEFAULT_GRAPH_COLUMNS),
    );
    expect(ids(shiftColumn(DEFAULT_GRAPH_COLUMNS, "message", 1))[2]).toBe("message");
  });

  it("clamps widths and falls back to the defaults", () => {
    const wide = updateColumn(DEFAULT_GRAPH_COLUMNS, "author", { width: 5000 });
    const author = wide.find((column) => column.id === "author");
    expect(author && columnWidth(author)).toBe(MAX_COLUMN_WIDTH_PX);
    expect(columnWidth({ id: "commit", visible: true, width: null })).toBe(88);
  });
});
