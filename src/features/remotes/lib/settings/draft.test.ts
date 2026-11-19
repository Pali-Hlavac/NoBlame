import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import {
  canonicalKey,
  changeCount,
  effectiveValue,
  emptyDraft,
  setValues,
  toEdit,
  valuesOf,
} from "./draft";
import { gitRelease, supports } from "./registry";

const BASE: RemoteSettingsDto = {
  name: "origin",
  head: "main",
  branches: ["main"],
  localBranches: ["main"],
  usesLfs: false,
  sshKey: null,
  entries: [
    { key: "remote.origin.prune", value: "false", scope: "global", file: null, secret: false },
    { key: "remote.origin.pushurl", value: "a", scope: "local", file: null, secret: false },
    { key: "remote.origin.pushurl", value: "b", scope: "local", file: null, secret: false },
  ],
};

describe("remote editor draft", () => {
  it("lowers section and name but keeps the subsection", () => {
    expect(canonicalKey("remote.Up.Stream.tagOpt")).toBe("remote.Up.Stream.tagopt");
    expect(canonicalKey("Push.followTags")).toBe("push.followtags");
  });

  it("drops a change that sets the values read", () => {
    const changed = setValues(BASE, emptyDraft(BASE), "remote.origin.pushUrl", ["a"]);
    expect(changeCount(BASE, changed)).toBe(1);
    expect(valuesOf(BASE, changed, "remote.origin.pushurl")).toEqual(["a"]);
    const back = setValues(BASE, changed, "remote.origin.pushurl", ["a", "b"]);
    expect(changeCount(BASE, back)).toBe(0);
  });

  it("uses the repository's value over the user's", () => {
    const draft = emptyDraft(BASE);
    expect(effectiveValue(BASE, draft, "remote.origin.prune")).toBe("false");
    const local = setValues(BASE, draft, "remote.origin.prune", ["true"]);
    expect(effectiveValue(BASE, local, "remote.origin.prune")).toBe("true");
  });

  it("sends the values read with the values wanted, the name and the default branch", () => {
    const draft = {
      ...setValues(BASE, emptyDraft(BASE), "remote.origin.tagOpt", ["--no-tags"]),
      name: "github",
      head: null,
    };
    expect(toEdit(BASE, draft)).toEqual({
      name: "origin",
      newName: "github",
      head: { before: "main", after: null },
      keys: [{ key: "remote.origin.tagOpt", before: [], after: ["--no-tags"] }],
    });
  });

  it("reads git versions and compares them", () => {
    expect(gitRelease("2.56.0.windows.2")).toEqual([2, 56]);
    expect(gitRelease("unknown")).toBeNull();
    expect(supports([2, 47], [2, 48])).toBe(false);
    expect(supports([2, 48], [2, 48])).toBe(true);
    expect(supports([3, 0], [2, 48])).toBe(true);
    expect(supports(null, [2, 48])).toBe(true);
  });
});
