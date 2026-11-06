import type { RefActions } from "@/features/graph";
import type { RefEntry } from "@/shared/ipc/bindings";

import { branchMenu } from "./menu";

function entry(kind: RefEntry["label"]["kind"], name: string, isHead = false): RefEntry {
  return { label: { kind, name, isHead }, target: "abc", row: 0, commitTime: 0 };
}

function actions(): RefActions & Record<string, ReturnType<typeof vi.fn>> {
  return {
    checkoutBranch: vi.fn(),
    checkoutCommit: vi.fn(),
    checkoutRemote: vi.fn(),
    createBranch: vi.fn(),
    createTag: vi.fn(),
    renameBranch: vi.fn(),
    deleteRef: vi.fn(),
  };
}

function ids(items: ReturnType<typeof branchMenu>): string[] {
  return items.filter((item) => item.type === "item").map((item) => item.id);
}

describe("branchMenu", () => {
  it("offers what fits each kind of reference", () => {
    const copy = vi.fn();
    expect(ids(branchMenu(entry("branch", "topic"), actions(), copy))).toEqual([
      "checkout",
      "create-branch",
      "create-tag",
      "rename",
      "delete",
      "copy-name",
    ]);
    // The checked-out branch: no checking out again, never deleted.
    expect(ids(branchMenu(entry("branch", "main", true), actions(), copy))).toEqual([
      "create-branch",
      "create-tag",
      "rename",
      "copy-name",
    ]);
    expect(ids(branchMenu(entry("remote", "origin/x"), actions(), copy))).toEqual([
      "checkout",
      "create-branch",
      "create-tag",
      "copy-name",
    ]);
    expect(ids(branchMenu(entry("tag", "v1"), actions(), copy))).toEqual([
      "create-branch",
      "delete",
      "copy-name",
    ]);
    expect(branchMenu(entry("head", "HEAD", true), actions(), copy)).toEqual([]);
  });

  it("sets, changes and removes a local branch's upstream", () => {
    const upstream = { has: false, set: vi.fn(), unset: vi.fn() };
    const without = branchMenu(entry("branch", "topic"), actions(), vi.fn(), upstream);
    expect(ids(without)).toContain("set-upstream");
    expect(ids(without)).not.toContain("unset-upstream");
    const set = without.find((item) => item.type === "item" && item.id === "set-upstream");
    expect(set?.type === "item" && set.label).toBe("Set upstream…");
    const tracked = branchMenu(entry("branch", "topic"), actions(), vi.fn(), {
      ...upstream,
      has: true,
    });
    const unset = tracked.find((item) => item.type === "item" && item.id === "unset-upstream");
    if (unset?.type === "item") unset.run();
    expect(upstream.unset).toHaveBeenCalledOnce();
    expect(tracked.some((item) => item.type === "item" && item.label === "Change upstream…")).toBe(
      true,
    );
  });

  it("starts new branches at the full reference name", () => {
    const refActions = actions();
    const menu = branchMenu(entry("remote", "origin/x"), refActions, vi.fn());
    for (const item of menu) if (item.type === "item" && item.id !== "copy-name") item.run();
    expect(refActions.checkoutRemote).toHaveBeenCalledWith({
      namespace: "remote",
      name: "origin/x",
      target: "abc",
    });
    expect(refActions.createBranch).toHaveBeenCalledWith({
      revision: "refs/remotes/origin/x",
      label: "origin/x",
    });
  });
});
