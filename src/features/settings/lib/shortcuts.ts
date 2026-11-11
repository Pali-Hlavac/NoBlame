/** Changing keyboard shortcuts (Settings → Keyboard shortcuts): which keys may be used, and saving. */
import { formatHotkey, parseHotkey, sameHotkey } from "@/shared/lib/hotkeys";
import { KEYBINDINGS, defaultKeysOf } from "@/shared/lib/keybindings";

/** A shortcut the user gave other keys (as in the settings file). */
export interface ChangedShortcut {
  id: string;
  /** Empty: no shortcut. */
  keys: string;
}

/** Function keys work alone; any other key needs Ctrl, Alt or Cmd, or typing would trigger it. */
const FUNCTION_KEY = /^f([1-9]|1[0-9]|2[0-4])$/;

/** Keys the system or text fields already use, with what they do. */
const RESERVED: readonly (readonly [string, string])[] = [
  ["mod+c", "copies"],
  ["mod+x", "cuts"],
  ["mod+v", "pastes"],
  ["mod+a", "selects all text"],
  ["mod+z", "undoes typing"],
  ["mod+y", "redoes typing"],
  ["mod+shift+z", "redoes typing"],
  ["alt+f4", "closes the window"],
  ["mod+q", "quits the app"],
];

/**
 * Why `keys` cannot become shortcut `id`'s keys, or `null` when they can. `keysOf` gives every
 * shortcut's current keys, to find the one already using them.
 */
export function shortcutProblem(
  id: string,
  keys: string,
  keysOf: (id: string) => string,
  isMac: boolean,
): string | null {
  if (keys === "") return null;
  const parsed = parseHotkey(keys, isMac);
  const label = formatHotkey(keys, isMac);
  if (!parsed.ctrl && !parsed.meta && !parsed.alt && !FUNCTION_KEY.test(parsed.key)) {
    return `${label} would be typed in text fields: add Ctrl, Alt${isMac ? " or Cmd" : ""}, or use a function key (F1–F12).`;
  }
  const reserved = RESERVED.find(([combo]) => sameHotkey(combo, keys, isMac));
  if (reserved) return `${label} ${reserved[1]}.`;
  const taken = KEYBINDINGS.find(
    (binding) => binding.id !== id && sameHotkey(keysOf(binding.id), keys, isMac),
  );
  if (taken) {
    return `${label} is already the shortcut of “${taken.label}” (${taken.group}). Change that one first.`;
  }
  return null;
}

/**
 * The changed shortcuts after giving `id` the keys `keys`: dropped from the list when they are
 * the app's own keys again. The order and entries of other ids stay as they were.
 */
export function withShortcut(
  changed: readonly ChangedShortcut[],
  id: string,
  keys: string,
): ChangedShortcut[] {
  const others = changed.filter((shortcut) => shortcut.id !== id);
  return keys === defaultKeysOf(id) ? others : [...others, { id, keys }];
}
