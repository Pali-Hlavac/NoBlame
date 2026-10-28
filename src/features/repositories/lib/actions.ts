/**
 * Actions offered on a repository in the Repositories module ("…" menu). The app shell supplies
 * them (see `src/app/workbench/repositoryActions.ts`), so this feature does not depend on the
 * features that implement pulling, committing, and so on.
 */
import type { LucideIcon } from "lucide-react";
import { createContext } from "react";

/** The repository an action runs on. */
export interface RepositoryTarget {
  path: string;
  /** Tab id; the repository is open when the action is offered. */
  tabId: string;
  title: string;
}

export interface RepositoryAction {
  id: string;
  label: string;
  icon: LucideIcon;
  /** What the action does; missing for stubs. */
  run?: (repository: RepositoryTarget) => void;
  /** Set for stubs: the milestone that delivers the action (the item is disabled). */
  milestone?: string;
  /** Draws a separator above the item. */
  group?: "start";
}

export const RepositoryActionsContext = createContext<readonly RepositoryAction[]>([]);
