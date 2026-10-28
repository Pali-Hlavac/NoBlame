import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

/**
 * A module: a view that opens in the module dock from the activity bar. Modules know nothing
 * about where they are docked; they read shared state (active repository, selected commit)
 * themselves. Adding one is a feature folder plus one entry in the app's module list.
 */
export interface WorkbenchModule {
  /** Stable id; saved in layouts, so never reuse or rename one. */
  id: string;
  /** Tab title and activity bar label. */
  title: string;
  icon: LucideIcon;
  /** Shortcut that opens the module, e.g. `alt+1`. */
  hotkey?: string;
  /** The module's content. */
  component: ComponentType;
}

/** A toolbar button. Data, so the app shell decides what the toolbar offers. */
export interface ToolbarAction {
  id: string;
  label: string;
  icon: LucideIcon;
  /** What the button does; missing for stubs. */
  run?: () => void;
  /** Set for stubs: the milestone that delivers the action (the button is disabled). */
  milestone?: string;
  /** Related actions in a drop-down next to the button (a split button). */
  menu?: readonly ToolbarAction[];
}
