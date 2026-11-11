/**
 * Every keyboard shortcut of the app in one place: what it does, where it works and its keys
 * (combos as in `hotkeys.ts`: `mod` is Cmd on macOS, Ctrl elsewhere). Features read their keys
 * from here (`useKeys`, `keysOf`) instead of writing them down themselves, and Settings lists
 * them all and lets the user change them (kept in the settings, applied here).
 * Keys typed inside lists (arrows, Enter, Delete) belong to their component and are not here,
 * nor are the browser shortcuts the app turns off (`native-feel.ts`).
 */

export interface Keybinding {
  /** Stable id (`module.branches`, `history.find`). */
  id: string;
  /** What it does, as the palette and Settings name it. */
  label: string;
  /** Where it applies, a heading in Settings. */
  group: "General" | "Tabs" | "History" | "Commit" | "Modules";
  /** The app's keys; the user may give others (`keysOf` gives the current ones). */
  keys: string;
}

const MODULES: readonly (readonly [string, string, string])[] = [
  ["repositories", "Repositories", "alt+1"],
  ["branches", "Branches", "alt+2"],
  ["commit-details", "Commit details", "alt+3"],
  ["stashes", "Stashes", "alt+4"],
  ["changed-files", "Changed files", "alt+5"],
  ["files", "Files", "alt+6"],
  ["commit", "Commit", "alt+7"],
  ["reflog", "Reflog", "alt+8"],
  ["worktrees", "Worktrees", "alt+9"],
  ["lfs", "Git LFS", "alt+0"],
];

export const KEYBINDINGS: readonly Keybinding[] = [
  { id: "palette.open", label: "Command palette", group: "General", keys: "mod+k" },
  { id: "settings.open", label: "Open settings", group: "General", keys: "mod+," },
  { id: "regions.next", label: "Next part of the window", group: "General", keys: "f6" },
  {
    id: "regions.previous",
    label: "Previous part of the window",
    group: "General",
    keys: "shift+f6",
  },
  { id: "tabs.close", label: "Close the tab", group: "Tabs", keys: "mod+w" },
  { id: "tabs.next", label: "Next tab", group: "Tabs", keys: "ctrl+tab" },
  { id: "tabs.previous", label: "Previous tab", group: "Tabs", keys: "ctrl+shift+tab" },
  { id: "history.find", label: "Find commits", group: "History", keys: "mod+f" },
  { id: "history.goto", label: "Go to commit", group: "History", keys: "mod+shift+g" },
  { id: "commit.commit", label: "Commit (in the message box)", group: "Commit", keys: "mod+enter" },
  ...MODULES.map(([module, title, keys]): Keybinding => ({
    id: `module.${module}`,
    label: `Show ${title}`,
    group: "Modules",
    keys,
  })),
];

/** The app's own keys of shortcut `id`. Unknown ids are a programming error (caught by tests). */
export function defaultKeysOf(id: string): string {
  const binding = KEYBINDINGS.find((candidate) => candidate.id === id);
  if (!binding) throw new Error(`No keyboard shortcut ${id}`);
  return binding.keys;
}

/**
 * The keys the user gave, by id (an empty string: no shortcut). Settings are their only source:
 * the settings feature's `KeybindingsController` hands them over here whenever they change, so
 * key handlers outside React read the current keys too.
 */
let userKeys: ReadonlyMap<string, string> = new Map();
const listeners = new Set<() => void>();

/** The keys of shortcut `id` now: the user's when they changed it, the app's otherwise. */
export function keysOf(id: string): string {
  return userKeys.get(id) ?? defaultKeysOf(id);
}

/** The user's keys now (a new map after each change; for `useSyncExternalStore`). */
export function userKeybindings(): ReadonlyMap<string, string> {
  return userKeys;
}

/** Takes the user's keys from the settings; ids the app does not know are left out. */
export function setUserKeybindings(changed: readonly { id: string; keys: string }[]): void {
  const known = new Set(KEYBINDINGS.map((binding) => binding.id));
  const next = new Map(
    changed.filter((change) => known.has(change.id)).map((change) => [change.id, change.keys]),
  );
  const same =
    next.size === userKeys.size && [...next].every(([id, keys]) => userKeys.get(id) === keys);
  if (same) return;
  userKeys = next;
  for (const listener of listeners) listener();
}

/** Calls `listener` whenever the user's keys change; returns how to stop. */
export function subscribeKeybindings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The shortcuts grouped for display, groups in their first-seen order. */
export function groupedKeybindings(): [Keybinding["group"], Keybinding[]][] {
  const groups = new Map<Keybinding["group"], Keybinding[]>();
  for (const binding of KEYBINDINGS) {
    const list = groups.get(binding.group) ?? [];
    list.push(binding);
    groups.set(binding.group, list);
  }
  return [...groups.entries()];
}
