import type { TreeSearchDto } from "@/shared/ipc/bindings";

import { searchRows } from "./searchRows";

const FOUND: TreeSearchDto = {
  rows: [
    { path: "docs", depth: 0, entry: { name: "docs", kind: "folder", id: "t1" }, matched: false },
    {
      path: "docs/view.md",
      depth: 1,
      entry: { name: "view.md", kind: "file", id: "b1" },
      matched: true,
    },
    { path: "src", depth: 0, entry: { name: "src", kind: "folder", id: "t2" }, matched: false },
    {
      path: "src/view",
      depth: 1,
      entry: { name: "view", kind: "folder", id: "t3" },
      matched: true,
    },
    {
      path: "src/view/a.rs",
      depth: 2,
      entry: { name: "a.rs", kind: "file", id: "b2" },
      matched: true,
    },
  ],
  matches: 3,
  complete: false,
};

describe("searchRows", () => {
  it("opens every folder, marks the ones only on the way, and says when it stopped", () => {
    const rows = searchRows(FOUND, new Set());
    expect(rows.map((row) => [row.path, row.type === "entry" && row.expanded])).toEqual([
      ["docs", true],
      ["docs/view.md", false],
      ["src", true],
      ["src/view", true],
      ["src/view/a.rs", false],
      ["\0more", false],
    ]);
    expect(rows[0]?.type === "entry" && rows[0].onTheWay).toBe(true);
    expect(rows[3]?.type === "entry" && rows[3].onTheWay).toBe(false);
  });

  it("skips what is inside a closed folder", () => {
    const rows = searchRows({ ...FOUND, complete: true }, new Set(["src"]));
    expect(rows.map((row) => row.path)).toEqual(["docs", "docs/view.md", "src"]);
  });
});
