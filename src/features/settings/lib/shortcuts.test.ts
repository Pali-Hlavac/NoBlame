import { defaultKeysOf } from "@/shared/lib/keybindings";

import { shortcutProblem, withShortcut } from "./shortcuts";

describe("shortcutProblem", () => {
  const keysOf = (id: string): string => (id === "tabs.close" ? "" : defaultKeysOf(id));

  it("accepts free keys, function keys alone, and no shortcut", () => {
    expect(shortcutProblem("history.find", "mod+alt+f", keysOf, false)).toBeNull();
    expect(shortcutProblem("history.find", "f3", keysOf, false)).toBeNull();
    expect(shortcutProblem("history.find", "", keysOf, false)).toBeNull();
    // Its own keys, and keys freed by another shortcut.
    expect(shortcutProblem("history.find", "mod+f", keysOf, false)).toBeNull();
    expect(shortcutProblem("history.find", "mod+w", keysOf, false)).toBeNull();
  });

  it("refuses keys typing would trigger", () => {
    expect(shortcutProblem("history.find", "f", keysOf, false)).toMatch(/typed in text fields/);
    expect(shortcutProblem("history.find", "shift+f", keysOf, false)).toMatch(/Ctrl, Alt, or/);
    expect(shortcutProblem("history.find", "shift+f", keysOf, true)).toMatch(/or Cmd/);
  });

  it("refuses copy, paste and the like", () => {
    expect(shortcutProblem("history.find", "mod+c", keysOf, false)).toBe("Ctrl+C copies.");
    expect(shortcutProblem("history.find", "alt+f4", keysOf, false)).toBe(
      "Alt+F4 closes the window.",
    );
  });

  it("names the shortcut that already has the keys, as this platform reads them", () => {
    expect(shortcutProblem("history.find", "mod+k", keysOf, false)).toBe(
      "Ctrl+K is already the shortcut of “Command palette” (General). Change that one first.",
    );
    expect(shortcutProblem("history.find", "mod+tab", keysOf, false)).toMatch(/“Next tab”/);
    expect(shortcutProblem("history.find", "mod+tab", keysOf, true)).toBeNull();
  });
});

describe("withShortcut", () => {
  const changed = [
    { id: "unknown.later", keys: "alt+x" },
    { id: "history.find", keys: "f3" },
  ];

  it("keeps a changed shortcut once, after the others", () => {
    expect(withShortcut(changed, "history.find", "mod+alt+f")).toEqual([
      { id: "unknown.later", keys: "alt+x" },
      { id: "history.find", keys: "mod+alt+f" },
    ]);
    expect(withShortcut([], "tabs.close", "")).toEqual([{ id: "tabs.close", keys: "" }]);
  });

  it("drops a shortcut given its own keys again", () => {
    expect(withShortcut(changed, "history.find", "mod+f")).toEqual([
      { id: "unknown.later", keys: "alt+x" },
    ]);
  });
});
