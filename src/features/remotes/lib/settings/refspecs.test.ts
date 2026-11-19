import { branchPatternProblem, chosenRefspecs, everyBranch, readFetch } from "./refspecs";

describe("fetch refspecs", () => {
  it("reads every branch, chosen branches and anything else", () => {
    expect(readFetch("origin", [everyBranch("origin")])).toEqual({ kind: "all" });
    expect(readFetch("origin", chosenRefspecs("origin", ["main", "release/*"]))).toEqual({
      kind: "chosen",
      branches: ["main", "release/*"],
    });
    expect(readFetch("origin", [])).toEqual({ kind: "chosen", branches: [] });
    expect(readFetch("origin", ["+refs/heads/*:refs/remotes/other/*"])).toEqual({
      kind: "custom",
    });
    expect(readFetch("origin", ["+refs/heads/a:refs/remotes/origin/b"])).toEqual({
      kind: "custom",
    });
    expect(readFetch("a.b", [everyBranch("a.b")])).toEqual({ kind: "all" });
    expect(readFetch("a.b", ["+refs/heads/x:refs/remotes/aXb/x"])).toEqual({ kind: "custom" });
  });

  it("refuses what cannot be a branch or a pattern", () => {
    expect(branchPatternProblem("release/*")).toBeNull();
    expect(branchPatternProblem("")).not.toBeNull();
    expect(branchPatternProblem("a b")).not.toBeNull();
    expect(branchPatternProblem("*/*")).not.toBeNull();
    expect(branchPatternProblem("a:b")).not.toBeNull();
    expect(branchPatternProblem("-x")).not.toBeNull();
  });
});
