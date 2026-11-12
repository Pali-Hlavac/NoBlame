/**
 * The folder or file a task window shows (`noblame commit src/`): its status, and staging all,
 * are limited to it. Set once, before the window's views render; the main window leaves it
 * unset (the whole working tree).
 */
let scope: string | null = null;

/** Limits this window's status to `relative` (with `/`); empty or `null` for all of it. */
export function setStatusScope(relative: string | null): void {
  scope = relative === null || relative === "" ? null : relative;
}

/** The folder or file the status is limited to, or `null` for the whole working tree. */
export function statusScope(): string | null {
  return scope;
}
