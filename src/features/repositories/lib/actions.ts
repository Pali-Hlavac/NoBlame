/**
 * Actions offered on a repository ("…" menu, quick buttons) and on a group (its menu, quick
 * buttons) in the Repositories module. The app shell supplies them (see
 * `src/app/workbench/repositoryActions.ts`), so this feature does not depend on the features
 * that implement pulling, committing, and so on.
 */
import type { LucideIcon } from "lucide-react";
import { createContext, type ReactNode } from "react";

import type { JobKindDto, RepositoryButton } from "@/shared/ipc/bindings";
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
  /** Also a quick button on the row, when Settings → Repositories turns this one on. */
  button?: RepositoryButton;
  /** The kind of job it starts: its quick button spins while one runs there. */
  job?: JobKindDto;
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

/** The group an action runs on. */
export interface GroupTarget {
  name: string;
  /** Its repositories, in order. */
  paths: readonly string[];
}

/** An action on every repository of a group (Pull all), after Open all in the group's menu. */
export interface GroupAction {
  id: string;
  label: string;
  icon: LucideIcon;
  kind?: WorkKind;
  run: (group: GroupTarget) => void;
  /** Also a quick button on the group's row, when Settings → Repositories turns it on. */
  button?: RepositoryButton;
  /** The kind of job it starts: its quick button spins while one runs in the group. */
  job?: JobKindDto;
}

export const GroupActionsContext = createContext<readonly GroupAction[]>([]);

/** Opens the Clone dialog (supplied by the app shell; no Clone button without it). */
export const CloneRepositoryContext = createContext<(() => void) | null>(null);

/**
 * A bar shown above a repository's commits (the operation in progress, supplied by the app
 * shell so this feature does not depend on the one that draws it); nothing without it.
 */
export const RepositoryBannerContext = createContext<((repoId: number) => ReactNode) | null>(null);
