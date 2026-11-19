import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import { emptyDraft } from "./draft";
import { searchRemote } from "./search";

const BASE: RemoteSettingsDto = {
  name: "origin",
  head: null,
  branches: [],
  localBranches: ["main"],
  usesLfs: false,
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

describe("search over settings that apply", () => {
  const withUrl = (url: string, usesLfs = false): RemoteSettingsDto => ({
    ...BASE,
    usesLfs,
    entries: [{ key: "remote.origin.url", value: url, scope: "local", file: null, secret: false }],
  });
  const found = (base: RemoteSettingsDto, query: string) =>
    searchRemote(query, base, emptyDraft(base))?.matches.map((match) => match.id) ?? [];

  it("finds only the settings the tabs show for the remote's URL", () => {
    const azure = withUrl("https://dev.azure.com/contoso/Web/_git/app");
    const ssh = withUrl("git@github.com:ada/app.git");
    expect(found(azure, "personal access token")).toEqual(["azureCredentialType"]);
    expect(found(withUrl("https://github.com/ada/app.git"), "personal access token")).toEqual([]);
    expect(found(ssh, "proxy")).toEqual([]);
    expect(found(ssh, "switch account")).toEqual([]);
  });

  it("finds LFS settings only when the LFS tab is shown", () => {
    expect(found(withUrl("https://github.com/ada/app.git"), "locksverify")).toEqual([]);
    expect(found(withUrl("https://github.com/ada/app.git", true), "locksverify")).toEqual([
      "locksverify",
    ]);
  });
});
