import { workingTreeRows } from "./rows";

const clean = {
  staged: 0,
  unstaged: 0,
  untracked: 0,
  conflicted: 0,
  changes: { added: 0, changed: 0, deleted: 0 },
};

describe("workingTreeRows", () => {
  it("shows nothing for a clean tree or a bare repository", () => {
    expect(workingTreeRows(clean)).toEqual([]);
    expect(workingTreeRows(null)).toEqual([]);
  });

  it("puts the working tree above the staged changes", () => {
    const rows = workingTreeRows({
      staged: 2,
      unstaged: 3,
      untracked: 1,
      conflicted: 1,
      changes: { added: 0, changed: 0, deleted: 0 },
    });
    expect(rows.map((row) => row.kind)).toEqual(["worktree", "index"]);
    expect(rows[0]?.detail).toBe("1 conflicted, 3 changed, 1 untracked");
    expect(rows[1]?.detail).toBe("2 files");
  });

  it("shows only the staged row when nothing else changed", () => {
    const rows = workingTreeRows({ ...clean, staged: 1 });
    expect(rows).toEqual([{ kind: "index", title: "Staged changes", detail: "1 file" }]);
  });
});
