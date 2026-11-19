import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import { emptyDraft, toEdit } from "./draft";
import { setUpstream, trackingBranches, upstreamOf } from "./tracking";

const local = (key: string, value: string) => ({
  key,
  value,
  scope: "local" as const,
  file: null,
  secret: false,
});

const BASE: RemoteSettingsDto = {
  name: "origin",
  head: "main",
  branches: ["main", "dev"],
  localBranches: ["main", "dev", "spike"],
  entries: [
    local("branch.main.remote", "origin"),
    local("branch.main.merge", "refs/heads/main"),
    local("branch.spike.remote", "upstream"),
    local("branch.spike.merge", "refs/heads/spike"),
  ],
};

describe("branches tracking a remote", () => {
  it("lists the branches tracking it and what they track", () => {
    const draft = emptyDraft(BASE);
    expect(trackingBranches(BASE, draft)).toEqual(["main"]);
    expect(upstreamOf(BASE, draft, "main")).toBe("main");
    expect(upstreamOf(BASE, draft, "spike")).toBeNull();
  });

  it("sets and clears upstreams as git does, keeping a cleared branch listed", () => {
    let draft = setUpstream(BASE, emptyDraft(BASE), "dev", "dev");
    expect(trackingBranches(BASE, draft)).toEqual(["dev", "main"]);
    draft = setUpstream(BASE, draft, "main", null);
    expect(trackingBranches(BASE, draft)).toEqual(["dev", "main"]);
    expect(upstreamOf(BASE, draft, "main")).toBeNull();
    expect(toEdit(BASE, draft).keys).toEqual([
      { key: "branch.dev.remote", before: [], after: ["origin"] },
      { key: "branch.dev.merge", before: [], after: ["refs/heads/dev"] },
      { key: "branch.main.remote", before: ["origin"], after: [] },
      { key: "branch.main.merge", before: ["refs/heads/main"], after: [] },
    ]);
  });
});
