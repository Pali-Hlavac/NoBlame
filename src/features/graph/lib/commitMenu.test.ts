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
    stashes: [],
  };
}

function actions() {
  return {
    copy: vi.fn(),
    copyMessage: vi.fn(),
    highlighted: false as boolean | undefined,
    toggleHighlight: vi.fn(),
    browseFiles: vi.fn(),
    compareWithHead: vi.fn() as (() => void) | undefined,
    compareWithWorkingTree: vi.fn() as (() => void) | undefined,
    compareWithCurrent: vi.fn(),
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
    expect(find(entries, "cherry-pick")).toMatchObject({ milestone: "M5" });
    expect(find(entries, "rebase-interactive")).toMatchObject({ milestone: "M5" });
    expect(find(entries, "bisect-bad")).toMatchObject({ milestone: "M7" });
    expect(find(entries, "patch")).toMatchObject({ milestone: "M7" });
  });

  it("compares with the working tree, except in a bare repository", () => {
    const handlers = actions();
    const entry = find(commitMenu(commit(), handlers), "compare-worktree");
    if (entry?.type !== "item") throw new Error("missing");
    expect(entry.milestone).toBeUndefined();
    entry.run?.();
    expect(handlers.compareWithWorkingTree).toHaveBeenCalled();
    handlers.compareWithWorkingTree = undefined;
    expect(find(commitMenu(commit(), handlers), "compare-worktree")).toBeUndefined();
  });

  it("compares with HEAD, except HEAD itself", () => {
    const handlers = actions();
    const entry = find(commitMenu(commit(), handlers), "compare-head");
    if (entry?.type !== "item") throw new Error("missing");
    expect(entry.milestone).toBeUndefined();
    entry.run?.();
    expect(handlers.compareWithHead).toHaveBeenCalled();
    handlers.compareWithHead = undefined;
    expect(find(commitMenu(commit(), handlers), "compare-head")).toMatchObject({ run: undefined });
  });

  it("compares a branch or tag with the current branch by its full name", () => {
    const handlers = actions();
    const entries = commitMenu(
      commit([
        { name: "feature", kind: "branch", isHead: false },
        { name: "v1.0", kind: "tag", isHead: false },
      ]),
      handlers,
    );
    const feature = find(entries, "ref:branch:feature");
    if (feature?.type !== "submenu") throw new Error("missing");
    const compare = feature.entries.find((entry) => entry.id === "compare");
    if (compare?.type !== "item") throw new Error("missing");
    compare.run?.();
    expect(handlers.compareWithCurrent).toHaveBeenCalledWith("refs/heads/feature");
    const tag = find(entries, "ref:tag:v1.0");
    if (tag?.type !== "submenu") throw new Error("missing");
    expect(tag.entries.some((entry) => entry.id === "compare")).toBe(true);
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

  it("runs branch and tag actions when the app provides them", () => {
    const refs = {
      checkoutBranch: vi.fn(),
      checkoutCommit: vi.fn(),
      checkoutRemote: vi.fn(),
      createBranch: vi.fn(),
      createTag: vi.fn(),
      renameBranch: vi.fn(),
      deleteRef: vi.fn(),
      pushBranch: vi.fn(),
      pushTag: vi.fn(),
      deleteOnRemote: vi.fn(),
      merge: vi.fn(),
      cherryPick: vi.fn(),
      revert: vi.fn(),
      rebase: vi.fn(),
      reset: vi.fn(),
      interactiveRebase: vi.fn(),
      bisect: vi.fn(),
    };
    const handlers = { ...actions(), refs };
    const row = commit([
      { name: "main", kind: "branch", isHead: true },
      { name: "topic", kind: "branch", isHead: false },
      { name: "origin/topic", kind: "remote", isHead: false },
      { name: "v1.0", kind: "tag", isHead: false },
    ]);
    const entries = commitMenu(row, handlers);
    const run = (where: MenuEntry | undefined, id: string) => {
      const entries = where?.type === "submenu" ? where.entries : [];
      const entry = entries.find((candidate) => candidate.id === id);
      if (entry?.type !== "item") throw new Error(`missing ${id}`);
      expect(entry.milestone).toBeUndefined();
      entry.run?.();
    };
    const here = { revision: row.id, label: "01234567 Fix the parser" };
    for (const [id, action] of [
      ["checkout", refs.checkoutCommit],
      ["create-branch", refs.createBranch],
      ["create-tag", refs.createTag],
      ["reset", refs.reset],
      ["rebase", refs.rebase],
    ] as const) {
      const entry = find(entries, id);
      if (entry?.type !== "item") throw new Error("missing");
      entry.run?.();
      expect(action).toHaveBeenCalledWith(here);
    }
    for (const [id, action] of [
      ["cherry-pick", refs.cherryPick],
      ["revert", refs.revert],
    ] as const) {
      const entry = find(entries, id);
      if (entry?.type !== "item") throw new Error("missing");
      entry.run?.();
      expect(action).toHaveBeenCalledWith({ ...here, parentCount: row.parentCount });
    }
    for (const mark of ["bad", "good", "skip"] as const) {
      const entry = find(entries, `bisect-${mark}`);
      if (entry?.type !== "item") throw new Error("missing");
      entry.run?.();
      expect(refs.bisect).toHaveBeenCalledWith(here, mark);
    }
    run(find(entries, "ref:branch:topic"), "checkout");
    expect(refs.checkoutBranch).toHaveBeenCalledWith("topic");
    run(find(entries, "ref:branch:topic"), "rename");
    const topic = { namespace: "branch", name: "topic", target: row.id };
    expect(refs.renameBranch).toHaveBeenCalledWith(topic);
    run(find(entries, "ref:branch:topic"), "delete");
    expect(refs.deleteRef).toHaveBeenCalledWith(topic);
    run(find(entries, "ref:remote:origin/topic"), "checkout");
    expect(refs.checkoutRemote).toHaveBeenCalledWith({
      namespace: "remote",
      name: "origin/topic",
      target: row.id,
    });
    run(find(entries, "ref:tag:v1.0"), "delete");
    expect(refs.deleteRef).toHaveBeenCalledWith({ namespace: "tag", name: "v1.0", target: row.id });
    // The checked-out branch can be renamed, never deleted.
    const main = find(entries, "ref:branch:main");
    if (main?.type !== "submenu") throw new Error("missing");
    expect(main.entries.map((entry) => entry.id)).toContain("rename");
    expect(main.entries.map((entry) => entry.id)).not.toContain("delete");
  });
});
