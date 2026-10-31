/** Public API of the workspace feature: the open tabs (documents) and the Welcome tab. */
export { WelcomeView } from "./components/WelcomeView";
export { TAB_HOTKEYS, useTabHotkeys } from "./hooks/useTabHotkeys";
export {
  DIFF_TAB,
  FILE_TAB,
  HISTORY_TAB,
  SETTINGS_TAB,
  WELCOME_TAB,
  showDiffTab,
  showFileTab,
  showHistoryTab,
  useActiveRepositoryTab,
  useActiveTab,
  useTabsStore,
} from "./store/tabs";
export { isWorkspaceTab } from "./types";
export type { DiffTab, FileTab, HistoryTab, RepositoryTab, WorkspaceTab } from "./types";
