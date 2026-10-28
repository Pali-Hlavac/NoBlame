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
