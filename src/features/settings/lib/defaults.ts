import type {
  BranchesSettings,
  JobsSettings,
  DiffSettings,
  ExternalDiffTool,
  ExternalMergeTool,
  GraphSettings,
  RepositoriesSettings,
  Settings,
  ThemePreference,
} from "@/shared/ipc/bindings";

import { WHOLE_FILE_CONTEXT } from "./diff";
import { DEFAULT_GRAPH_COLUMNS } from "./graphColumns";

/**
 * Settings with every field present. The generated `Settings` has optional fields (the backend
 * fills missing ones from defaults), so the UI works on this shape instead.
 */
export interface AppSettings {
  theme: ThemePreference;
  graph: Required<GraphSettings>;
  repositories: Required<RepositoriesSettings>;
  diff: AppDiffSettings;
  branches: Required<BranchesSettings>;
  jobs: Required<JobsSettings>;
  /** User scripts, in menu order. */
  scripts: { name: string; command: string }[];
}

/** The diff settings with every field present, the external tools' too. */
export type AppDiffSettings = Required<Omit<DiffSettings, "externalTool" | "mergeTool">> & {
  externalTool: Required<ExternalDiffTool>;
  mergeTool: Required<ExternalMergeTool>;
};

/** What the backend uses for missing settings (`src-tauri/src/settings/types.rs`). */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  graph: {
    highlightSelection: true,
    workingTree: "rows",
    columns: [...DEFAULT_GRAPH_COLUMNS],
    dateDisplay: "absolute",
  },
  repositories: {
    showActionsMenu: true,
    showChangeCounts: false,
    buttons: [],
    sections: ["open", "groups", "recent"],
    collapsedSections: [],
  },
  diff: {
    layout: "unified",
    whitespace: "show",
    contextLines: 3,
    wholeFile: false,
    syntaxHighlighting: true,
    externalTool: { kind: "git", command: "" },
    mergeTool: { kind: "git", name: "" },
  },
  branches: { sort: "name" },
  jobs: { showOutputWindow: false, closeOutputOnSuccess: true },
  scripts: [],
};

/** Fills fields missing from `settings` with their defaults. */
export function withDefaults(settings: Settings | undefined): AppSettings {
  return {
    theme: settings?.theme ?? DEFAULT_SETTINGS.theme,
    graph: { ...DEFAULT_SETTINGS.graph, ...settings?.graph },
    repositories: { ...DEFAULT_SETTINGS.repositories, ...settings?.repositories },
    diff: migrateDiff({
      ...DEFAULT_SETTINGS.diff,
      ...settings?.diff,
      externalTool: { ...DEFAULT_SETTINGS.diff.externalTool, ...settings?.diff?.externalTool },
      mergeTool: { ...DEFAULT_SETTINGS.diff.mergeTool, ...settings?.diff?.mergeTool },
    }),
    branches: { ...DEFAULT_SETTINGS.branches, ...settings?.branches },
    jobs: { ...DEFAULT_SETTINGS.jobs, ...settings?.jobs },
    scripts: (settings?.scripts ?? []).map((script) => ({
      name: script.name ?? "",
      command: script.command ?? "",
    })),
  };
}

/** Earlier versions stored "whole file" as a huge number of context lines. */
function migrateDiff(diff: AppDiffSettings): AppDiffSettings {
  return diff.contextLines === WHOLE_FILE_CONTEXT
    ? { ...diff, contextLines: DEFAULT_SETTINGS.diff.contextLines, wholeFile: true }
    : diff;
}
