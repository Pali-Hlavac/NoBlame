import type { RefEntry } from "@/shared/ipc/bindings";

import { linkKey, upstreamLinks } from "./upstreamLinks";

const ref = (kind: RefEntry["label"]["kind"], name: string, row: number | null): RefEntry => ({
  label: { kind, name, isHead: false },
  target: `c${row ?? "none"}`,
  row,
  commitTime: 0,
});

const REFS = [
  ref("branch", "main", 3),
  ref("remote", "origin/main", 0),
  ref("branch", "same", 5),
  ref("remote", "origin/same", 5),
  ref("branch", "hidden", 2),
  ref("remote", "origin/hidden", null),
];

describe("upstreamLinks", () => {
  it("links a branch and its upstream both ways when they differ", () => {
    const links = upstreamLinks(REFS, [
      { branch: "main", upstream: "refs/remotes/origin/main", gone: false },
    ]);
    expect(links.get(linkKey({ kind: "branch", name: "main" }))).toEqual({
      name: "origin/main",
      row: 0,
      toUpstream: true,
    });
    expect(links.get(linkKey({ kind: "remote", name: "origin/main" }))).toEqual({
      name: "main",
      row: 3,
      toUpstream: false,
    });
  });

  it("skips pairs on one commit, gone upstreams and commits the graph does not show", () => {
    const links = upstreamLinks(REFS, [
      { branch: "same", upstream: "refs/remotes/origin/same", gone: false },
      { branch: "hidden", upstream: "refs/remotes/origin/hidden", gone: false },
      { branch: "main", upstream: "refs/remotes/origin/main", gone: true },
    ]);
    expect(links.size).toBe(0);
  });
});
