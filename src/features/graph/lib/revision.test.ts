import { refRevision } from "./revision";

describe("refRevision", () => {
  it("names references in full", () => {
    expect(refRevision({ kind: "branch", name: "main" })).toBe("refs/heads/main");
    expect(refRevision({ kind: "remote", name: "origin/main" })).toBe("refs/remotes/origin/main");
    expect(refRevision({ kind: "tag", name: "v1.0" })).toBe("refs/tags/v1.0");
    expect(refRevision({ kind: "head", name: "HEAD" })).toBe("HEAD");
  });
});
