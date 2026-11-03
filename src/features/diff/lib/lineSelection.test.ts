import type { DiffLineDto } from "@/shared/ipc/bindings";

import { chosenLines, hunkLines, keyOfRow, toRanges } from "./lineSelection";

function row(kind: DiffLineDto["kind"], oldLine: number | null, newLine: number | null) {
  return { kind, oldLine, newLine, text: "", truncated: false, highlights: [], syntax: [] };
}

describe("line selection", () => {
  it("names changed rows by the version they belong to", () => {
    expect(keyOfRow(row("removed", 4, null))).toBe("o4");
    expect(keyOfRow(row("added", null, 7))).toBe("n7");
    expect(keyOfRow(row("context", 4, 5))).toBeUndefined();
  });

  it("joins neighbouring lines into ranges", () => {
    expect(toRanges([7, 2, 1, 3])).toEqual([
      { start: 1, end: 3 },
      { start: 7, end: 7 },
    ]);
    expect(chosenLines(["o3", "n4", "n5", "o2"])).toEqual({
      removed: [{ start: 2, end: 3 }],
      added: [{ start: 4, end: 5 }],
    });
  });

  it("reads a hunk header as the lines of both versions", () => {
    expect(hunkLines("@@ -3,4 +3,5 @@ fn main()")).toEqual({
      removed: [{ start: 3, end: 6 }],
      added: [{ start: 3, end: 7 }],
    });
    // One line leaves out its length; an empty side has none.
    expect(hunkLines("@@ -0,0 +1 @@")).toEqual({ removed: [], added: [{ start: 1, end: 1 }] });
    expect(hunkLines("not a header")).toBeNull();
  });
});
