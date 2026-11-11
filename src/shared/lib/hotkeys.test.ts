import {
  comboOfEvent,
  formatHotkey,
  matchesHotkey,
  parseHotkey,
  sameHotkey,
  withHotkey,
} from "./hotkeys";

const keyEvent = (key: string, modifiers: Partial<KeyboardEvent> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...modifiers,
});

describe("parseHotkey", () => {
  it("maps mod to meta on macOS and ctrl elsewhere", () => {
    expect(parseHotkey("mod+k", true)).toMatchObject({ key: "k", meta: true, ctrl: false });
    expect(parseHotkey("mod+k", false)).toMatchObject({ key: "k", meta: false, ctrl: true });
  });
});

describe("matchesHotkey", () => {
  it("matches the exact combo case-insensitively", () => {
    expect(matchesHotkey(keyEvent("K", { ctrlKey: true }), "mod+k", false)).toBe(true);
  });

  it("rejects extra modifiers", () => {
    expect(matchesHotkey(keyEvent("k", { ctrlKey: true, shiftKey: true }), "mod+k", false)).toBe(
      false,
    );
  });

  it("rejects the wrong platform modifier", () => {
    expect(matchesHotkey(keyEvent("k", { ctrlKey: true }), "mod+k", true)).toBe(false);
  });
});

describe("formatHotkey", () => {
  it("uses symbols on macOS", () => {
    expect(formatHotkey("mod+shift+p", true)).toBe("⌘⇧P");
  });

  it("uses words elsewhere", () => {
    expect(formatHotkey("mod+shift+p", false)).toBe("Ctrl+Shift+P");
  });
});

describe("comboOfEvent", () => {
  it("writes the primary modifier as mod, then alt and shift", () => {
    expect(comboOfEvent(keyEvent("F", { ctrlKey: true, shiftKey: true }), false)).toBe(
      "mod+shift+f",
    );
    expect(comboOfEvent(keyEvent("f", { metaKey: true, ctrlKey: true }), true)).toBe("mod+ctrl+f");
    expect(comboOfEvent(keyEvent("1", { altKey: true }), false)).toBe("alt+1");
    expect(comboOfEvent(keyEvent("F6"), false)).toBe("f6");
  });

  it("names space and plus, and waits while only modifiers are held", () => {
    expect(comboOfEvent(keyEvent(" ", { ctrlKey: true }), false)).toBe("mod+space");
    expect(comboOfEvent(keyEvent("+", { ctrlKey: true }), false)).toBe("mod+plus");
    expect(comboOfEvent(keyEvent("Control", { ctrlKey: true }), false)).toBeNull();
    expect(comboOfEvent(keyEvent("Dead", { altKey: true }), false)).toBeNull();
  });

  it("records what matching later recognises", () => {
    const event = keyEvent(" ", { ctrlKey: true, shiftKey: true });
    const combo = comboOfEvent(event, false) ?? "";
    expect(matchesHotkey(event, combo, false)).toBe(true);
  });
});

describe("sameHotkey", () => {
  it("compares combos as this platform reads them", () => {
    expect(sameHotkey("mod+tab", "ctrl+tab", false)).toBe(true);
    expect(sameHotkey("mod+tab", "ctrl+tab", true)).toBe(false);
    expect(sameHotkey("alt+1", "alt+2", false)).toBe(false);
  });
});

describe("withHotkey", () => {
  it("adds the keys only when there are some", () => {
    expect(withHotkey("Settings", "mod+,", false)).toBe("Settings (Ctrl+,)");
    expect(withHotkey("Settings", "", false)).toBe("Settings");
  });
});
