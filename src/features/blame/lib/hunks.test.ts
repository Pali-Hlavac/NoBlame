import type { BlameCommitDto, BlameHunkDto } from "@/shared/ipc/bindings";

import { blamePrevious, goBack, showBlame, useBlameStore } from "../store/blame";
import { describeHunk, hunkAt, recency } from "./hunks";

const FIRST: BlameHunkDto = { line: 1, count: 3, commit: 0, originalLine: 1, path: 0 };
const SECOND: BlameHunkDto = { line: 4, count: 1, commit: 1, originalLine: 9, path: 0 };
const HUNKS = [FIRST, SECOND, { line: 5, count: 2, commit: 0, originalLine: 4, path: 1 }];

function commit(authorTime: number): BlameCommitDto {
  return {
    id: "0123456789abcdef0123456789abcdef01234567",
    summary: "Fix it",
    authorName: "Ada",
    authorEmail: "ada@example.com",
    authorTime,
    previous: null,
  };
}

describe("hunkAt", () => {
  it("finds the hunk of every line and nothing past the end", () => {
    expect([1, 3, 4, 5, 6].map((line) => hunkAt(HUNKS, line)?.commit)).toEqual([0, 0, 1, 0, 0]);
    expect(hunkAt(HUNKS, 7)).toBeUndefined();
    expect(hunkAt([], 1)).toBeUndefined();
  });
});

describe("recency", () => {
  it("ranks commits from the oldest (0) to the newest (1)", () => {
    expect(recency([commit(300), commit(100), commit(200), commit(100)])).toEqual([1, 0, 0.5, 0]);
    expect(recency([commit(5)])).toEqual([0]);
  });
});

describe("describeHunk", () => {
  it("names the lines, the commit and its author", () => {
    expect(describeHunk(FIRST, commit(0), "today")).toBe(
      "Lines 1 to 3: 01234567 by Ada on today, Fix it",
    );
    expect(describeHunk(SECOND, commit(0), "today")).toMatch(/^Line 4:/);
  });
});

describe("blame store", () => {
  beforeEach(() => {
    useBlameStore.setState({ targets: {}, back: {} });
  });

  it("goes to previous revisions and back, and starts over on a new blame", () => {
    showBlame("/repo", { commit: "c3", path: "new.rs" });
    blamePrevious("/repo", { commit: "c2", path: "old.rs" });
    blamePrevious("/repo", { commit: "c1", path: "old.rs" });
    goBack("/repo");
    expect(useBlameStore.getState().targets["/repo"]).toEqual({ commit: "c2", path: "old.rs" });
    goBack("/repo");
    goBack("/repo");
    expect(useBlameStore.getState().targets["/repo"]).toEqual({ commit: "c3", path: "new.rs" });
    blamePrevious("/repo", { commit: "c2", path: "old.rs" });
    showBlame("/repo", { commit: "c9", path: "x.rs" });
    expect(useBlameStore.getState().back["/repo"]).toEqual([]);
  });
});
