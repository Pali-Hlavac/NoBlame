import { KEYBINDINGS, groupedKeybindings, keysOf } from "./keybindings";

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
});
