import type { WorkingTreeStatusDto } from "@/shared/ipc/bindings";

import { filesOf, totalOf } from "./files";

const STATUS: WorkingTreeStatusDto = {
  summary: {
    staged: 2,
    unstaged: 3,
    untracked: 4,
    conflicted: 1,
    changes: { added: 0, changed: 0, deleted: 0 },
  },
  staged: [],
  unstaged: [],
};

describe("working tree files", () => {
  it("gives each row its own files and total", () => {
    expect(filesOf(STATUS, "index")).toBe(STATUS.staged);
    expect(filesOf(STATUS, "worktree")).toBe(STATUS.unstaged);
    expect(totalOf(STATUS.summary, "index")).toBe(2);
    expect(totalOf(STATUS.summary, "worktree")).toBe(8);
  });
});
