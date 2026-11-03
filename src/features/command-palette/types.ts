import type { LucideIcon } from "lucide-react";

import type { WorkKind } from "@/shared/lib/workKinds";

/** An action that can be run from the command palette. */
export interface PaletteCommand {
  /** Unique, stable id (React key). */
  id: string;
  /** Heading the command is grouped under, e.g. "Appearance". */
  group: string;
  /** Unique visible text; also what the search ranks against. */
  label: string;
  icon?: LucideIcon;
  /** What it is about; colours its icon (`src/shared/lib/workKinds.ts`). */
  kind?: WorkKind;
  /** Hotkey combo that runs the same action, shown as a hint. */
  hotkey?: string;
  /** Extra search terms that are not part of the label. */
  keywords?: string[];
  run: () => void;
}
