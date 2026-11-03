/**
 * Actions offered on a repository in the Repositories module ("…" menu). The app shell supplies
 * them (see `src/app/workbench/repositoryActions.ts`), so this feature does not depend on the
 * features that implement pulling, committing, and so on.
 */
import type { LucideIcon } from "lucide-react";
import { createContext } from "react";

import type { WorkKind } from "@/shared/lib/workKinds";

/** The repository an action runs on. */
export interface RepositoryTarget {
  path: string;
  /** Its repository tab's id (open or not). */
  tabId: string;
  title: string;
  /** It has a tab open. */
  open: boolean;
}

export interface RepositoryAction {
  id: string;
  label: string;
  icon: LucideIcon;
  /** What it is about; colours its icon (`src/shared/lib/workKinds.ts`). */
  kind?: WorkKind;
  /** What the action does; missing for stubs. */
  run?: (repository: RepositoryTarget) => void;
  /** Set for stubs: the milestone that delivers the action (the item is disabled). */
  milestone?: string;
  /** Draws a separator above the item. */
  group?: "start";
  /** Offered only while the repository is open (or only while it is not). */
  when?: "open" | "closed";
}

/** The actions offered for `target`. */
export function actionsFor(
  actions: readonly RepositoryAction[],
  target: RepositoryTarget,
): RepositoryAction[] {
  return actions.filter(
    (action) => action.when === undefined || (action.when === "open") === target.open,
  );
}

export const RepositoryActionsContext = createContext<readonly RepositoryAction[]>([]);
