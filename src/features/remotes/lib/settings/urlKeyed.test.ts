import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import { emptyDraft, setValues, toEdit } from "./draft";
import { moveUrlSettings, serverOf, staleUrlSettings } from "./urlKeyed";

const local = (key: string, value: string) => ({
  key,
  value,
  scope: "local" as const,
  file: null,
  secret: false,
});

const BASE: RemoteSettingsDto = {
  name: "origin",
  head: null,
  branches: [],
  localBranches: [],
  usesLfs: false,
  sshKey: null,
  entries: [
    local("remote.origin.url", "https://old.example/team/app.git"),
    local("http.https://old.example/.proxy", "http://proxy:8080"),
    local("credential.https://old.example.username", "ada"),
    local("http.https://other.example/.sslverify", "false"),
  ],
};

describe("settings keyed by the remote's server", () => {
  it("reads the server of a URL", () => {
    expect(serverOf("https://ada@Old.Example:8443/x")).toBe("https://old.example:8443");
    expect(serverOf("git@old.example:x.git")).toBeNull();
  });

  it("lists the old server's settings when the URL moves, and moves them", () => {
    const sameServer = setValues(BASE, emptyDraft(BASE), "remote.origin.url", [
      "https://old.example/team/other.git",
    ]);
    expect(staleUrlSettings(BASE, sameServer)).toEqual([]);

    const moved = setValues(BASE, emptyDraft(BASE), "remote.origin.url", [
      "https://new.example/team/app.git",
    ]);
    const stale = staleUrlSettings(BASE, moved);
    expect(stale.map((setting) => setting.newKey)).toEqual([
      "http.https://new.example/.proxy",
      "credential.https://new.example.username",
    ]);
    const draft = moveUrlSettings(BASE, moved, stale);
    expect(staleUrlSettings(BASE, draft)).toEqual([]);
    expect(toEdit(BASE, draft).keys).toContainEqual({
      key: "http.https://new.example/.proxy",
      before: [],
      after: ["http://proxy:8080"],
    });
    expect(toEdit(BASE, draft).keys).toContainEqual({
      key: "http.https://old.example/.proxy",
      before: ["http://proxy:8080"],
      after: [],
    });
  });
});
