import type {
  AppIcon,
  BranchesSettings,
  CommitSettings,
  JobsSettings,
  SubmoduleSettings,
  TaskWindowSettings,
  UpdateSettings,
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
  appIcon: AppIcon;
  graph: Required<GraphSettings>;
  repositories: Required<RepositoriesSettings>;
  diff: AppDiffSettings;
  branches: Required<BranchesSettings>;
  commit: Required<CommitSettings>;
  jobs: Required<JobsSettings>;
  submodules: Required<SubmoduleSettings>;
  taskWindows: Required<TaskWindowSettings>;
  updates: Required<UpdateSettings>;
  /** User scripts, in menu order. */
  scripts: { name: string; command: string }[];
  /** Keyboard shortcuts given other keys than the app's (empty keys: no shortcut). */
  keybindings: { id: string; keys: string }[];
}

/** The diff settings with every field present, the external tools' too. */
export type AppDiffSettings = Required<Omit<DiffSettings, "externalTool" | "mergeTool">> & {
  externalTool: Required<ExternalDiffTool>;
  mergeTool: Required<ExternalMergeTool>;
};

/** What the backend uses for missing settings (`src-tauri/src/settings/types.rs`). */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  appIcon: "golden",
  graph: {
    highlightSelection: true,
    workingTree: "rows",
    columns: [...DEFAULT_GRAPH_COLUMNS],
    dateDisplay: "absolute",
    showMessageBody: false,
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
  commit: { fileDisplay: "nameFirst" },
  jobs: { showOutputWindow: false, closeOutputOnSuccess: true },
  submodules: { fetchSubmodules: true, updateAfterPullAndCheckout: false },
  taskWindows: { closeAfterSuccess: false },
  updates: { checkOnStart: true },
  scripts: [],
  keybindings: [],
};

/** Fills fields missing from `settings` with their defaults. */
export function withDefaults(settings: Settings | undefined): AppSettings {
  return {
    theme: settings?.theme ?? DEFAULT_SETTINGS.theme,
    appIcon: settings?.appIcon ?? DEFAULT_SETTINGS.appIcon,
    graph: { ...DEFAULT_SETTINGS.graph, ...settings?.graph },
    repositories: { ...DEFAULT_SETTINGS.repositories, ...settings?.repositories },
    diff: migrateDiff({
      ...DEFAULT_SETTINGS.diff,
      ...settings?.diff,
      externalTool: { ...DEFAULT_SETTINGS.diff.externalTool, ...settings?.diff?.externalTool },
      mergeTool: { ...DEFAULT_SETTINGS.diff.mergeTool, ...settings?.diff?.mergeTool },
    }),
    branches: { ...DEFAULT_SETTINGS.branches, ...settings?.branches },
    commit: { ...DEFAULT_SETTINGS.commit, ...settings?.commit },
    jobs: { ...DEFAULT_SETTINGS.jobs, ...settings?.jobs },
    submodules: { ...DEFAULT_SETTINGS.submodules, ...settings?.submodules },
    taskWindows: { ...DEFAULT_SETTINGS.taskWindows, ...settings?.taskWindows },
    updates: { ...DEFAULT_SETTINGS.updates, ...settings?.updates },
    scripts: (settings?.scripts ?? []).map((script) => ({
      name: script.name ?? "",
      command: script.command ?? "",
    })),
    keybindings: (settings?.keybindings ?? []).map((shortcut) => ({
      id: shortcut.id ?? "",
      keys: shortcut.keys ?? "",
    })),
  };
}

/** Earlier versions stored "whole file" as a huge number of context lines. */
function migrateDiff(diff: AppDiffSettings): AppDiffSettings {
  return diff.contextLines === WHOLE_FILE_CONTEXT
    ? { ...diff, contextLines: DEFAULT_SETTINGS.diff.contextLines, wholeFile: true }
    : diff;
}
