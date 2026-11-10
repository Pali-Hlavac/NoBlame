import type { WorkingFileDto, WorkingTreeStatusDto } from "@/shared/ipc/bindings";

import { stashRequest, stashableFiles } from "./push";

function file(path: string, status: WorkingFileDto["status"], previousPath?: string) {
  return {
    path,
    previousPath: previousPath ?? null,
    status,
    oldId: null,
    newId: null,
    worktree: true,
    submodule: false,
    submoduleChanges: null,
  };
}

const STATUS: WorkingTreeStatusDto = {
  summary: {
    staged: 2,
    unstaged: 1,
    untracked: 1,
    conflicted: 0,
    changes: { added: 0, changed: 0, deleted: 0 },
  },
  staged: [file("b.txt", "modified"), file("new/c.txt", "renamed", "old/c.txt")],
  operation: null,
  unstaged: [file("b.txt", "modified"), file("a.txt", "untracked")],
};
const FORM = { message: "wip", keepIndex: false, includeUntracked: false };

describe("stashing", () => {
  it("lists each file once and new files only when asked", () => {
    expect(stashableFiles(STATUS, false).map((f) => f.path)).toEqual(["b.txt", "new/c.txt"]);
    expect(stashableFiles(STATUS, true).map((f) => f.path)).toEqual([
      "a.txt",
      "b.txt",
      "new/c.txt",
    ]);
  });

  it("stashes everything without paths when every file is chosen and listed", () => {
    const files = stashableFiles(STATUS, false);
    expect(stashRequest(FORM, files, [], true).paths).toBeNull();
    expect(stashRequest(FORM, files, [], false).paths).toEqual(["b.txt", "old/c.txt", "new/c.txt"]);
  });

  it("names the chosen files, both names of a rename", () => {
    const files = stashableFiles(STATUS, false);
    expect(stashRequest(FORM, files, ["b.txt"], true)).toEqual({
      ...FORM,
      paths: ["old/c.txt", "new/c.txt"],
    });
  });
});
