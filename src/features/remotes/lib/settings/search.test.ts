import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import { emptyDraft } from "./draft";
import { searchRemote } from "./search";

const BASE: RemoteSettingsDto = {
  name: "origin",
  head: null,
  branches: [],
  localBranches: ["main"],
  sshKey: null,
  entries: [
    {
      key: "remote.origin.vcs",
      value: "Subversion",
      scope: "local",
      file: null,
      secret: false,
    },
  ],
};

function ids(query: string): string[] {
  return searchRemote(query, BASE, emptyDraft(BASE))?.matches.map((match) => match.id) ?? [];
}

describe("remote editor search", () => {
  it("finds settings by label, git key and synonyms, in tab order", () => {
    expect(ids("tagopt")).toEqual(["tagOpt"]);
    expect(ids("refspec")).toEqual(["fetch", "pushRefspecs"]);
    expect(ids("Mirror")).toEqual(["pushurl", "mirror"]);
    expect(ids("prune tags")).toContain("pruneTags");
  });

  it("finds Advanced keys by key and value, ignoring case and accents", () => {
    expect(ids("subversión")).toEqual(["key:remote.origin.vcs"]);
    expect(ids("remote.origin.vcs")).toContain("key:remote.origin.vcs");
  });

  it("counts matches per tab and finds nothing for an empty query", () => {
    const result = searchRemote("push", BASE, emptyDraft(BASE));
    expect(result?.counts.get("push")).toBeGreaterThan(3);
    expect(searchRemote("  ", BASE, emptyDraft(BASE))).toBeNull();
  });
});
