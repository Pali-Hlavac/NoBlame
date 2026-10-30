import { describe, expect, it, vi } from "vitest";

import type { CommitRowDto, RefLabel } from "@/shared/ipc/bindings";

import { commitMenu, type MenuEntry } from "./commitMenu";

function commit(refs: RefLabel[] = []): CommitRowDto {
  return {
    row: 0,
    id: "0123456789abcdef0123456789abcdef01234567",
    summary: "Fix the parser",
    authorName: "Ada",
    authorEmail: "ada@example.com",
    authorTime: 0,
    parentCount: 1,
    refs,
  };
}

function actions() {
  return {
    copy: vi.fn(),
    copyMessage: vi.fn(),
    highlighted: false as boolean | undefined,
    toggleHighlight: vi.fn(),
    browseFiles: vi.fn(),
  };
}

function find(entries: readonly MenuEntry[], id: string): MenuEntry | undefined {
  for (const entry of entries) {
    if (entry.id === id) return entry;
    if (entry.type === "submenu") {
      const inner = find(entry.entries, id);
      if (inner) return inner;
    }
  }
  return undefined;
}

describe("commitMenu", () => {
  it("copies ids and the subject", () => {
    const handlers = actions();
    const entries = commitMenu(commit(), handlers);
    const shortId = find(entries, "copy-short-id");
    if (shortId?.type !== "item") throw new Error("missing");
    shortId.run?.();
    expect(handlers.copy).toHaveBeenCalledWith("01234567", "Short commit id");
  });

  it("browses the commit's files", () => {
    const handlers = actions();
    const browse = find(commitMenu(commit(), handlers), "browse");
    if (browse?.type !== "item") throw new Error("missing");
    expect(browse.milestone).toBeUndefined();
    browse.run?.();
    expect(handlers.browseFiles).toHaveBeenCalled();
  });

  it("names the milestone of operations that arrive later", () => {
    const entries = commitMenu(commit(), actions());
    expect(find(entries, "create-branch")).toMatchObject({ milestone: "M5" });
    expect(find(entries, "cherry-pick")).toMatchObject({ milestone: "M6" });
    expect(find(entries, "compare-head")).toMatchObject({ milestone: "M3" });
  });

  it("offers highlighting only when it is switched on", () => {
    const handlers = actions();
    expect(find(commitMenu(commit(), handlers), "highlight")).toMatchObject({
      label: "Highlight its history",
    });
    handlers.highlighted = true;
    expect(find(commitMenu(commit(), handlers), "highlight")).toMatchObject({
      label: "Clear the highlight",
    });
    handlers.highlighted = undefined;
    expect(find(commitMenu(commit(), handlers), "highlight")).toBeUndefined();
  });

  it("adds a submenu per branch and tag, without checking out the current branch", () => {
    const entries = commitMenu(
      commit([
        { name: "main", kind: "branch", isHead: true },
        { name: "v1.0", kind: "tag", isHead: false },
        { name: "HEAD", kind: "head", isHead: true },
      ]),
      actions(),
    );
    const main = find(entries, "ref:branch:main");
    if (main?.type !== "submenu") throw new Error("missing");
    expect(main.entries.some((entry) => entry.id === "checkout")).toBe(false);
    expect(find(entries, "ref:tag:v1.0")).toBeDefined();
    expect(find(entries, "ref:head:HEAD")).toBeUndefined();
  });
});
