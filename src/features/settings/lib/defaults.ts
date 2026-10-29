import type {
  DiffSettings,
  GraphSettings,
  RepositoriesSettings,
  Settings,
  ThemePreference,
} from "@/shared/ipc/bindings";

/**
 * Settings with every field present. The generated `Settings` has optional fields (the backend
 * fills missing ones from defaults), so the UI works on this shape instead.
 */
export interface AppSettings {
  theme: ThemePreference;
  graph: Required<GraphSettings>;
  repositories: Required<RepositoriesSettings>;
  diff: Required<DiffSettings>;
}

/** What the backend uses for missing settings (`src-tauri/src/settings/types.rs`). */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  graph: { highlightSelection: true, workingTree: "rows" },
  repositories: { showActionsMenu: true },
  diff: { layout: "unified", whitespace: "show", contextLines: 3 },
};

/** Fills fields missing from `settings` with their defaults. */
export function withDefaults(settings: Settings | undefined): AppSettings {
  return {
    theme: settings?.theme ?? DEFAULT_SETTINGS.theme,
    graph: { ...DEFAULT_SETTINGS.graph, ...settings?.graph },
    repositories: { ...DEFAULT_SETTINGS.repositories, ...settings?.repositories },
    diff: { ...DEFAULT_SETTINGS.diff, ...settings?.diff },
  };
}
