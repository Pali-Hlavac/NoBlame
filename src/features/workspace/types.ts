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

/** App settings (one tab at most). */
export interface SettingsTab extends TabBase {
  kind: "settings";
}

/** The diff of the file chosen in Changed files (one tab at most; it switches files in place). */
export interface DiffTab extends TabBase {
  kind: "diff";
}

/** The file chosen in the Files module, at the selected commit (one tab at most, like the diff). */
export interface FileTab extends TabBase {
  kind: "file";
}

/** Who last changed each line of a file at a commit (one tab at most). */
export interface BlameTab extends TabBase {
  kind: "blame";
}

/** The history of a file or folder chosen with "File history" (one tab at most). */
export interface HistoryTab extends TabBase {
  kind: "history";
}

/** Two revisions compared: the files that differ and their diffs (one tab at most). */
export interface CompareTab extends TabBase {
  kind: "compare";
}

/** One stash: its files and their diffs, with its actions (one tab at most). */
export interface StashTab extends TabBase {
  kind: "stash";
}

/** A conflicted file merged in the built-in merge view (one tab at most). */
export interface MergeTab extends TabBase {
  kind: "merge";
}

export type WorkspaceTab =
  | WelcomeTab
  | RepositoryTab
  | SettingsTab
  | DiffTab
  | FileTab
  | HistoryTab
  | BlameTab
  | CompareTab
  | StashTab
  | MergeTab;

/** Checks a tab read back from a saved layout (which may come from another app version). */
export function isWorkspaceTab(value: unknown): value is WorkspaceTab {
  if (typeof value !== "object" || value === null) return false;
  const tab = value as Record<string, unknown>;
  if (typeof tab.id !== "string" || typeof tab.title !== "string") return false;
  switch (tab.kind) {
    case "welcome":
    case "settings":
    case "diff":
    case "file":
    case "history":
    case "blame":
    case "compare":
    case "stash":
    case "merge":
      return true;
    case "repository":
      return typeof tab.path === "string";
    default:
      return false;
  }
}
