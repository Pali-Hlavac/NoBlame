/**
 * Several files chosen at once in a Commit list, as in a file manager: a click chooses one file,
 * Ctrl+click adds or removes one, Shift+click chooses the files from the last plain click to
 * this one, Ctrl+Shift+click adds them; Shift+arrows extend, Ctrl+arrows move without choosing.
 * The list's cursor is the file whose diff shows (the selection store's file).
 */
import type { RowGesture } from "@/shared/components/VirtualList";

/** What a list chose, by path. */
export interface Picked {
  paths: ReadonlySet<string>;
  /** Where ranges start: the last file clicked without Shift. */
  anchor: string | null;
  /** The cursor this choice was made with; when the cursor moves elsewhere, it no longer holds. */
  cursor: string | null;
}

export const NOTHING_PICKED: Picked = { paths: new Set(), anchor: null, cursor: null };

/**
 * The files chosen now: none while the cursor is in the other list; just the cursor when it
 * was moved from outside (a file shown from the graph, the next file after staging); else what
 * was picked that is still listed.
 */
export function pickedPaths(
  picked: Picked,
  paths: readonly string[],
  cursor: string | undefined,
): ReadonlySet<string> {
  if (cursor === undefined) return new Set();
  if (picked.cursor !== cursor) return new Set([cursor]);
  const listed = new Set(paths);
  return new Set([...picked.paths].filter((path) => listed.has(path)));
}

function range(paths: readonly string[], from: number, to: number): string[] {
  return paths.slice(Math.min(from, to), Math.max(from, to) + 1);
}

/** The choice after reaching `paths[index]` with `gesture`; `chosen` is what is chosen now. */
export function pick(
  picked: Picked,
  chosen: ReadonlySet<string>,
  paths: readonly string[],
  index: number,
  gesture: RowGesture,
): Picked {
  const path = paths[index];
  if (path === undefined) return picked;
  const one = { paths: new Set([path]), anchor: path, cursor: path };
  // A right click on a chosen file keeps the choice, so the menu acts on all of it.
  if (gesture.secondary) return chosen.has(path) ? { ...picked, paths: chosen, cursor: path } : one;
  if (gesture.shift) {
    const anchor = picked.anchor !== null && paths.includes(picked.anchor) ? picked.anchor : path;
    const span = range(paths, paths.indexOf(anchor), index);
    const next = gesture.ctrl ? new Set([...chosen, ...span]) : new Set(span);
    return { paths: next, anchor, cursor: path };
  }
  if (gesture.ctrl && gesture.via === "key") return { ...picked, paths: chosen, cursor: path };
  if (gesture.ctrl) return { paths: toggled(chosen, path), anchor: path, cursor: path };
  return one;
}

function toggled(paths: ReadonlySet<string>, path: string): Set<string> {
  const next = new Set(paths);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  return next;
}

/** Ctrl+Space: adds or removes the cursor's file. */
export function togglePick(chosen: ReadonlySet<string>, cursor: string): Picked {
  return { paths: toggled(chosen, cursor), anchor: cursor, cursor };
}

/** Ctrl+A: every listed file, keeping the cursor. */
export function pickAll(paths: readonly string[], cursor: string): Picked {
  return { paths: new Set(paths), anchor: cursor, cursor };
}
