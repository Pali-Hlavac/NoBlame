import type { ConfigScopeNameDto, RemoteSettingsDto } from "@/shared/ipc/bindings";

import { appliesTo, helperKind, helpersFor } from "./credentials";
import { emptyDraft, setValues } from "./draft";

const entry = (key: string, value: string, scope: ConfigScopeNameDto, file: string | null) => ({
  key,
  value,
  scope,
  file,
  secret: false,
});

const URL = "https://dev.azure.com/contoso/Web/_git/app";

function base(...entries: RemoteSettingsDto["entries"]): RemoteSettingsDto {
  return {
    name: "origin",
    head: null,
    branches: [],
    localBranches: [],
    usesLfs: false,
    sshKey: null,
    entries: [entry("remote.origin.url", URL, "local", null), ...entries],
  };
}

describe("credential helpers", () => {
  it("matches credential.<url> as git does", () => {
    expect(appliesTo("https://dev.azure.com", URL)).toBe(true);
    expect(appliesTo("https://dev.azure.com/", URL)).toBe(true);
    expect(appliesTo("https://dev.azure.com/contoso", URL)).toBe(true);
    expect(appliesTo("https://dev.azure.com/con", URL)).toBe(false);
    expect(appliesTo("http://dev.azure.com", URL)).toBe(false);
    expect(appliesTo("https://dev.azure.com:8443", URL)).toBe(false);
    expect(appliesTo("https://*.azure.com", URL)).toBe(true);
    expect(appliesTo("dev.azure.com", URL)).toBe(true);
    expect(appliesTo("https://ada@dev.azure.com", URL)).toBe(false);
    expect(appliesTo("https://ada@dev.azure.com", "https://ada@dev.azure.com/x")).toBe(true);
    expect(appliesTo("azrepos:org/contoso", URL)).toBe(false);
  });

  it("lists the helpers in the order git asks them, after resets", () => {
    const settings = base(
      entry("credential.helper", "manager", "system", "C:/Program Files/Git/etc/gitconfig"),
      entry("credential.https://github.com.helper", "store", "global", "C:/Users/ada/.gitconfig"),
      entry("credential.helper", "cache", "global", "C:/Users/ada/.gitconfig"),
    );
    const read = helpersFor(settings, emptyDraft(settings), URL);
    expect(read.helpers.map((helper) => helper.value)).toEqual(["manager", "cache"]);
    expect(read.helpers[0]?.from).toBe(
      "the system's settings (C:/Program Files/Git/etc/gitconfig)",
    );
    expect(read.resetIn).toBeNull();

    const draft = setValues(
      settings,
      emptyDraft(settings),
      "credential.https://dev.azure.com.helper",
      ["", "store"],
    );
    const changed = helpersFor(settings, draft, URL);
    expect(changed.helpers).toEqual([{ value: "store", from: "this repository's settings" }]);
    expect(changed.resetIn).toBe("this repository's settings");
  });

  it("says what a helper is", () => {
    expect(helperKind("manager").manager).toBe(true);
    expect(
      helperKind("C:/Program\\ Files/Git/mingw64/bin/git-credential-manager.exe").manager,
    ).toBe(true);
    expect(helperKind("store --file ~/.creds").warning).toMatch(/not encrypted/);
    expect(helperKind("osxkeychain").about).toMatch(/keychain/);
    expect(helperKind("!f() { echo; }; f").name).toBe("!f()");
  });
});
