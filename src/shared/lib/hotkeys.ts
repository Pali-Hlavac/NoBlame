/**
 * Hotkey parsing, matching and formatting. Combos are written like `mod+k` or
 * `mod+shift+p`, where `mod` means Cmd on macOS and Ctrl elsewhere.
 */

export interface ParsedHotkey {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

/** Parses a combo string for the given platform. */
export function parseHotkey(combo: string, isMac: boolean): ParsedHotkey {
  const parts = combo.toLowerCase().split("+");
  const has = (name: string): boolean => parts.includes(name);
  const mod = has("mod");
  return {
    key: parts.at(-1) ?? "",
    ctrl: has("ctrl") || (mod && !isMac),
    meta: has("meta") || (mod && isMac),
    shift: has("shift"),
    alt: has("alt"),
  };
}

type KeyEventLike = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

/** Keys whose `event.key` cannot be written in a combo as it is. */
const KEY_NAMES: Record<string, string> = { " ": "space", "+": "plus" };

/** The key of an event as combos name it (`k`, `f6`, `space`, `plus`). */
function keyName(key: string): string {
  return KEY_NAMES[key] ?? key.toLowerCase();
}

/** True when the keyboard event exactly matches the combo (no extra modifiers). */
export function matchesHotkey(event: KeyEventLike, combo: string, isMac: boolean): boolean {
  const hotkey = parseHotkey(combo, isMac);
  return (
    keyName(event.key) === hotkey.key &&
    event.ctrlKey === hotkey.ctrl &&
    event.metaKey === hotkey.meta &&
    event.shiftKey === hotkey.shift &&
    event.altKey === hotkey.alt
  );
}

const MAC_SYMBOLS: Record<string, string> = {
  mod: "⌘",
  meta: "⌘",
  ctrl: "⌃",
  shift: "⇧",
  alt: "⌥",
};
const PC_LABELS: Record<string, string> = {
  mod: "Ctrl",
  meta: "Win",
  ctrl: "Ctrl",
  shift: "Shift",
  alt: "Alt",
};

/** Keys whose capitalized name reads badly. */
const KEY_LABELS: Record<string, string> = {
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  pageup: "PageUp",
  pagedown: "PageDown",
  escape: "Esc",
};

/** True when two combos are the same keys on this platform (`mod+tab` is `ctrl+tab` off macOS). */
export function sameHotkey(first: string, second: string, isMac: boolean): boolean {
  const a = parseHotkey(first, isMac);
  const b = parseHotkey(second, isMac);
  return (
    a.key === b.key &&
    a.ctrl === b.ctrl &&
    a.meta === b.meta &&
    a.shift === b.shift &&
    a.alt === b.alt
  );
}

/** Keys that only modify others, or that say nothing about which key it was. */
const NOT_KEYS = new Set([
  "control",
  "shift",
  "alt",
  "altgraph",
  "meta",
  "os",
  "capslock",
  "dead",
  "unidentified",
  "process",
]);

/**
 * The combo a key press makes (`mod+shift+f`), with Ctrl (Cmd on macOS) written as `mod`;
 * `null` while only modifiers are held or for keys that cannot be told apart.
 */
export function comboOfEvent(event: KeyEventLike, isMac: boolean): string | null {
  const key = keyName(event.key);
  if (NOT_KEYS.has(key)) return null;
  const parts = [
    ...((isMac ? event.metaKey : event.ctrlKey) ? ["mod"] : []),
    ...(isMac && event.ctrlKey ? ["ctrl"] : []),
    ...(!isMac && event.metaKey ? ["meta"] : []),
    ...(event.altKey ? ["alt"] : []),
    ...(event.shiftKey ? ["shift"] : []),
    key,
  ];
  return parts.join("+");
}

/** `label (Ctrl+K)`, or only `label` when it has no shortcut (an empty combo). */
export function withHotkey(label: string, combo: string, isMac: boolean): string {
  return combo ? `${label} (${formatHotkey(combo, isMac)})` : label;
}

/** Human-readable label, e.g. `⌘K` on macOS and `Ctrl+K` elsewhere. */
export function formatHotkey(combo: string, isMac: boolean): string {
  const labels = isMac ? MAC_SYMBOLS : PC_LABELS;
  const parts = combo
    .split("+")
    .map(
      (part) =>
        labels[part.toLowerCase()] ??
        KEY_LABELS[part.toLowerCase()] ??
        part.charAt(0).toUpperCase() + part.slice(1),
    );
  return parts.join(isMac ? "" : "+");
}
