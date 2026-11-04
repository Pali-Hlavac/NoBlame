import type { ChangedFileDto, StashDto } from "@/shared/ipc/bindings";

import { applyRequest, stashDescription, stashFileList } from "./files";

function file(path: string, status: ChangedFileDto["status"], previousPath?: string) {
  return {
    path,
    previousPath: previousPath ?? null,
    status,
    oldId: null,
    newId: "1".repeat(40),
    submodule: false,
  };
}

const FILES = stashFileList({
  base: "0".repeat(40),
  changed: [file("a.txt", "modified"), file("new/b.txt", "renamed", "old/b.txt")],
  changedTotal: 2,
  untracked: [file("a.txt", "added")],
  untrackedTotal: 1,
});

describe("stash files", () => {
  it("lists untracked files after the changed ones, under their own keys", () => {
    expect(FILES.map((entry) => [entry.key, entry.status])).toEqual([
      ["a.txt", "modified"],
      ["new/b.txt", "renamed"],
      ["untracked:a.txt", "untracked"],
    ]);
  });

  it("applies both names of a rename and untracked files apart", () => {
    expect(applyRequest("abc", FILES, ["new/b.txt", "untracked:a.txt"])).toEqual({
      id: "abc",
      tracked: ["old/b.txt", "new/b.txt"],
      untracked: ["a.txt"],
    });
  });

  it("drops git's prefix from the message", () => {
    const stash: StashDto = {
      index: 0,
      id: "abc",
      message: "On main: half done",
      branch: "main",
      time: 0,
    };
    expect(stashDescription(stash)).toBe("half done");
    expect(stashDescription({ ...stash, branch: null, message: "custom" })).toBe("custom");
  });
});
