import { describe, expect, it } from "vitest";

import type { DiffLineDto, SplitLineDto } from "@/shared/ipc/bindings";

import { anchorAt, lineOfRow, scrollTopFor } from "./anchor";
import { ROW_HEIGHT_PX } from "./constants";

function unified(oldLine: number | null, newLine: number | null): DiffLineDto {
  return {
    kind: oldLine === null && newLine === null ? "hunk" : "context",
    oldLine,
    newLine,
    text: "",
    truncated: false,
    highlights: [],
    syntax: [],
  };
}

function cell(line: number): NonNullable<SplitLineDto["left"]> {
  return {
    kind: "context",
    line,
    text: "",
    truncated: false,
    noNewline: false,
    highlights: [],
    syntax: [],
  };
}

describe("lineOfRow", () => {
  it("prefers the new version's line", () => {
    expect(lineOfRow(unified(4, 5))).toEqual({ side: "new", line: 5 });
    expect(lineOfRow(unified(4, null))).toEqual({ side: "old", line: 4 });
    expect(lineOfRow(unified(null, null))).toBeNull();
    expect(lineOfRow({ hunk: null, left: cell(7), right: null })).toEqual({
      side: "old",
      line: 7,
    });
    expect(lineOfRow({ hunk: null, left: cell(7), right: cell(9) })).toEqual({
      side: "new",
      line: 9,
    });
  });
});

describe("anchorAt", () => {
  it("takes the middle row, or the first row with a line below it", () => {
    const rows = [unified(null, null), unified(1, 1), unified(2, 2), unified(null, null)];
    rows.push(unified(3, 3));
    const rowAt = (index: number) => rows[index];
    // A view of two rows scrolled to the top: the middle is row 1.
    expect(anchorAt(rowAt, 0, 2 * ROW_HEIGHT_PX, rows.length)).toEqual({
      side: "new",
      line: 1,
      offsetPx: ROW_HEIGHT_PX,
    });
    // Middle at the hunk header on row 3: row 4 is used.
    expect(anchorAt(rowAt, 2 * ROW_HEIGHT_PX, 2 * ROW_HEIGHT_PX, rows.length)).toEqual({
      side: "new",
      line: 3,
      offsetPx: 2 * ROW_HEIGHT_PX,
    });
    expect(anchorAt(() => undefined, 0, 100, rows.length)).toBeNull();
  });

  it("puts the found row where the anchor was", () => {
    const anchor = { side: "new" as const, line: 10, offsetPx: 3 * ROW_HEIGHT_PX };
    expect(scrollTopFor(20, anchor)).toBe(17 * ROW_HEIGHT_PX);
    expect(scrollTopFor(1, anchor)).toBe(0);
  });
});
