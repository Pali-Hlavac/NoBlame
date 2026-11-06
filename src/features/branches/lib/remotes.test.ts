import { describe, expect, it } from "vitest";

import { defaultRemote, splitRemoteBranch, upstreamOnRemote } from "./remotes";

describe("remote branch names", () => {
  const remotes = ["origin", "team", "team/eu"];

  it("splits by the longest matching remote", () => {
    expect(splitRemoteBranch("origin/feature/x", remotes)).toEqual({
      remote: "origin",
      branch: "feature/x",
    });
    expect(splitRemoteBranch("team/eu/main", remotes)).toEqual({
      remote: "team/eu",
      branch: "main",
    });
    expect(splitRemoteBranch("other/main", remotes)).toBeNull();
  });

  it("reads an upstream's remote and branch", () => {
    expect(upstreamOnRemote("refs/remotes/origin/main", remotes)).toEqual({
      remote: "origin",
      branch: "main",
    });
    expect(upstreamOnRemote("refs/heads/main", remotes)).toBeNull();
  });

  it("offers the preferred remote, else origin, else the first", () => {
    expect(defaultRemote(remotes, "team")).toBe("team");
    expect(defaultRemote(remotes, "gone")).toBe("origin");
    expect(defaultRemote(["fork"])).toBe("fork");
    expect(defaultRemote([])).toBeUndefined();
  });
});
