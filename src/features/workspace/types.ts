/** Workspace tab model ("documents" in the main dock). New tab kinds are added per milestone. */
interface TabBase {
  /** Stable identity; opening a tab with an existing id focuses it instead. */
  id: string;
  title: string;
}

/** Landing tab with getting-started actions and shortcuts. */
export interface WelcomeTab extends TabBase {
  kind: "welcome";
}

/** One repository: its commit graph. */
export interface RepositoryTab extends TabBase {
  kind: "repository";
  /** Absolute path as given by the user or the command line. */
  path: string;
}

export type WorkspaceTab = WelcomeTab | RepositoryTab;

/** Checks a tab read back from a saved layout (which may come from another app version). */
export function isWorkspaceTab(value: unknown): value is WorkspaceTab {
  if (typeof value !== "object" || value === null) return false;
  const tab = value as Record<string, unknown>;
  if (typeof tab.id !== "string" || typeof tab.title !== "string") return false;
  switch (tab.kind) {
    case "welcome":
      return true;
    case "repository":
      return typeof tab.path === "string";
    default:
      return false;
  }
}
