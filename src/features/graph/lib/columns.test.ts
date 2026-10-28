import { MIN_MESSAGE_WIDTH_PX, layoutColumns } from "./columns";

const GRAPH = 100;

describe("layoutColumns", () => {
  it("shows every column when there is room", () => {
    const layout = layoutColumns(2000, GRAPH);
    expect([...layout.visible]).toEqual(["author", "date", "commit"]);
    expect(layout.template).toBe("100px minmax(0,1fr) 160px 150px 88px");
  });

  it("drops the commit column first, then author, then date", () => {
    expect([...layoutColumns(750, GRAPH).visible]).toEqual(["author", "date"]);
    expect([...layoutColumns(600, GRAPH).visible]).toEqual(["date"]);
    expect([...layoutColumns(GRAPH + MIN_MESSAGE_WIDTH_PX, GRAPH).visible]).toEqual([]);
  });

  it("keeps the message column even when nothing fits", () => {
    expect(layoutColumns(50, GRAPH).template).toBe("100px minmax(0,1fr)");
  });
});
