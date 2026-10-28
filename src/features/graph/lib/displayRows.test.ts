import { displayRows, indexOfSelection, selectionAt } from "./displayRows";

const worktree = { kind: "worktree", title: "Working tree changes", detail: "1 changed" } as const;
const index = { kind: "index", title: "Staged changes", detail: "1 file" } as const;

describe("displayRows", () => {
  it("puts the working tree rows above the commits", () => {
    const rows = displayRows([worktree, index], 10);
    expect(rows.count).toBe(12);
    expect(selectionAt(rows, 0)).toEqual({ kind: "worktree" });
    expect(selectionAt(rows, 1)).toEqual({ kind: "index" });
    expect(selectionAt(rows, 2)).toEqual({ kind: "commit", row: 0 });
    expect(selectionAt(rows, 12)).toBeUndefined();
  });

  it("maps selections back to display indexes", () => {
    const rows = displayRows([index], 10);
    expect(indexOfSelection(rows, { kind: "commit", row: 3 })).toBe(4);
    expect(indexOfSelection(rows, { kind: "index" })).toBe(0);
    // The working tree row is gone (everything was staged): nothing to show as selected.
    expect(indexOfSelection(rows, { kind: "worktree" })).toBeUndefined();
  });

  it("is a plain commit list without working tree rows", () => {
    const rows = displayRows([], 5);
    expect(indexOfSelection(rows, { kind: "commit", row: 2 })).toBe(2);
    expect(selectionAt(rows, 0)).toEqual({ kind: "commit", row: 0 });
  });
});
