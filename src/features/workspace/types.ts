/** Workspace tab model. New tab kinds are added per milestone. */
interface TabBase {
  /** Stable identity; opening a tab with an existing id focuses it instead. */
  id: string;
  title: string;
}

/** Landing tab with getting-started actions and shortcuts. */
export interface WelcomeTab extends TabBase {
  kind: "welcome";
}

/** One repository. M1 shows a labelled placeholder; the commit graph arrives in M2. */
export interface RepositoryTab extends TabBase {
  kind: "repository";
  /** Absolute path as given by the user or the command line. */
  path: string;
}

export type WorkspaceTab = WelcomeTab | RepositoryTab;
