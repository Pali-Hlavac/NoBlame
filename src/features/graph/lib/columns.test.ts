import type { GraphColumn, GraphColumnId } from "@/shared/ipc/bindings";

import { GAP_PX, MIN_MESSAGE_WIDTH_PX, layoutColumns } from "./columns";

const GRAPH = 100;

const column = (id: GraphColumnId, visible = true, width: number | null = null): GraphColumn => ({
  id,
  visible,
  width,
});
const DEFAULTS = (["graph", "message", "author", "date", "commit"] as const).map((id) =>
  column(id),
);
const ids = (layout: ReturnType<typeof layoutColumns>) => layout.cells.map((cell) => cell.id);

describe("layoutColumns", () => {
  it("shows every column when there is room", () => {
    const layout = layoutColumns(2000, GRAPH, DEFAULTS);
    expect(ids(layout)).toEqual(["graph", "message", "author", "date", "commit"]);
    expect(layout.template).toBe("100px minmax(0,1fr) 160px 150px 88px");
    expect(layout.graphWidthPx).toBe(GRAPH);
  });

  it("drops the commit column first, then author, then date", () => {
    expect(ids(layoutColumns(750, GRAPH, DEFAULTS))).toEqual([
      "graph",
      "message",
      "author",
      "date",
    ]);
    expect(ids(layoutColumns(600, GRAPH, DEFAULTS))).toEqual(["graph", "message", "date"]);
    const bare = GRAPH + MIN_MESSAGE_WIDTH_PX + 2 * GAP_PX;
    expect(ids(layoutColumns(bare, GRAPH, DEFAULTS))).toEqual(["graph", "message"]);
  });

  it("keeps the message column even when nothing fits", () => {
    expect(layoutColumns(50, GRAPH, DEFAULTS).template).toBe("100px minmax(0,1fr)");
  });

  it("follows the saved order, widths and hidden columns", () => {
    const saved = [
      column("graph", true, 60),
      column("date", true, 90),
      column("message"),
      column("author", false),
      column("commit"),
    ];
    const layout = layoutColumns(2000, GRAPH, saved);
    expect(layout.template).toBe("60px 90px minmax(0,1fr) 88px");
    expect(layout.graphWidthPx).toBe(60);
  });

  it("keeps a hidden graph as an empty first cell", () => {
    const layout = layoutColumns(2000, GRAPH, [column("graph", false), ...DEFAULTS.slice(1)]);
    expect(layout.template.startsWith("0px minmax(0,1fr)")).toBe(true);
    expect(layout.graphWidthPx).toBe(0);
  });
});
