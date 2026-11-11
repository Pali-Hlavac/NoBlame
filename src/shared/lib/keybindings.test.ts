import {
  KEYBINDINGS,
  defaultKeysOf,
  groupedKeybindings,
  keysOf,
  setUserKeybindings,
  subscribeKeybindings,
} from "./keybindings";

describe("keybindings", () => {
  it("has one entry per id and no two shortcuts on the same keys", () => {
    const ids = KEYBINDINGS.map((binding) => binding.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = KEYBINDINGS.map((binding) => binding.keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives the keys of a shortcut and refuses unknown ids", () => {
    expect(keysOf("history.find")).toBe("mod+f");
    expect(keysOf("module.lfs")).toBe("alt+0");
    expect(() => keysOf("nope")).toThrow(/No keyboard shortcut nope/);
  });

  it("groups them for Settings", () => {
    const groups = groupedKeybindings().map(([group]) => group);
    expect(groups).toEqual(["General", "Tabs", "History", "Commit", "Modules"]);
  });

  it("uses the user's keys, telling subscribers only when they change", () => {
    const listener = vi.fn();
    const stop = subscribeKeybindings(listener);
    setUserKeybindings([
      { id: "history.find", keys: "mod+shift+f" },
      { id: "tabs.close", keys: "" },
      { id: "from.a.newer.version", keys: "alt+x" },
    ]);
    expect(keysOf("history.find")).toBe("mod+shift+f");
    expect(keysOf("tabs.close")).toBe("");
    expect(defaultKeysOf("history.find")).toBe("mod+f");
    expect(keysOf("module.lfs")).toBe("alt+0");
    setUserKeybindings([
      { id: "history.find", keys: "mod+shift+f" },
      { id: "tabs.close", keys: "" },
    ]);
    expect(listener).toHaveBeenCalledTimes(1);
    setUserKeybindings([]);
    expect(keysOf("history.find")).toBe("mod+f");
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });
});
