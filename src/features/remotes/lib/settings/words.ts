/** Small helpers the editor's components share: names in words and ids tying tabs to panels. */
import type { ConfigScopeNameDto } from "@/shared/ipc/bindings";

/** Where a value comes from, in words. */
export function scopeName(scope: ConfigScopeNameDto): string {
  switch (scope) {
    case "system":
      return "the system's settings";
    case "global":
      return "your user settings";
    case "local":
      return "this repository's settings";
    case "worktree":
      return "this worktree's settings";
  }
}

/** The id of the panel of `tab`, for `aria-controls` / `aria-labelledby`. */
export function panelId(idPrefix: string, tab: string): string {
  return `${idPrefix}-panel-${tab}`;
}

/** The id of the tab `tab`. */
export function tabId(idPrefix: string, tab: string): string {
  return `${idPrefix}-tab-${tab}`;
}
