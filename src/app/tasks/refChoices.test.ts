import type { RefEntry, RefKindDto } from "@/shared/ipc/bindings";

import { choosableRefs, operationInTheWay, upstreamValue } from "./refChoices";

function ref(kind: RefKindDto, name: string, isHead = false): RefEntry {
  return { label: { kind, name, isHead }, target: "a".repeat(40), row: 0, commitTime: 0 };
}

describe("what the Switch, Merge and Rebase windows offer", () => {
  it("leaves out the current branch, the remotes' HEAD and bisect marks", () => {
    const refs = [
      ref("branch", "main", true),
      ref("branch", "feature"),
      ref("remote", "origin/HEAD"),
      ref("remote", "origin/main"),
      ref("tag", "v1.0"),
      ref("bisect", "bad"),
      ref("head", "HEAD"),
    ];
    expect(choosableRefs(refs).map((entry) => entry.label.name)).toEqual([
      "feature",
      "origin/main",
      "v1.0",
    ]);
  });

  it("finds the upstream among them, remote or local", () => {
    expect(upstreamValue("refs/remotes/origin/main")).toBe("remote:origin/main");
    expect(upstreamValue("refs/heads/dev")).toBe("branch:dev");
    expect(upstreamValue(undefined)).toBeUndefined();
  });

  it("names an operation in progress, but lets a bisect be", () => {
    expect(operationInTheWay("merge")).toMatch(/^A merge is in progress/);
    expect(operationInTheWay("rebase")).toMatch(/Finish or abort it first/);
    expect(operationInTheWay("bisect")).toBeNull();
    expect(operationInTheWay(undefined)).toBeNull();
  });
});
