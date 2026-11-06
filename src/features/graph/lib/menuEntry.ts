/** Building blocks of the graph's context menus. */

/** Milestones of the stubbed entries (docs/roadmap.md). */
export const MENU_MILESTONES = {
  branches: "M5",
  history: "M6",
  advanced: "M7",
} as const;

export type MenuEntry =
  | {
      type: "item";
      id: string;
      label: string;
      /** Shown disabled with this milestone when set. */
      milestone?: string;
      run?: () => void;
    }
  | { type: "submenu"; id: string; label: string; entries: MenuEntry[] }
  | { type: "separator"; id: string };

export function item(id: string, label: string, milestone?: string, run?: () => void): MenuEntry {
  return { type: "item", id, label, milestone, run };
}

export function separator(id: string): MenuEntry {
  return { type: "separator", id };
}

/** A branch or tag entry: working with `run`, the labelled M5 stub without. */
export function refItem(id: string, label: string, run: (() => void) | undefined): MenuEntry {
  return item(id, label, run ? undefined : MENU_MILESTONES.branches, run);
}
