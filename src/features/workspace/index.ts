/** Public API of the workspace feature: the open tabs (documents) and the Welcome tab. */
export { WelcomeView } from "./components/WelcomeView";
export { TAB_HOTKEYS, useTabHotkeys } from "./hooks/useTabHotkeys";
export {
  BLAME_TAB,
  COMPARE_TAB,
  DIFF_TAB,
  FILE_TAB,
  HISTORY_TAB,
  SETTINGS_TAB,
  WELCOME_TAB,
  showBlameTab,
  showCompareTab,
  showDiffTab,
  showFileTab,
  setCloseFallback,
  showHistoryTab,
  useActiveRepositoryTab,
  useActiveTab,
  useTabsStore,
} from "./store/tabs";
export { isWorkspaceTab } from "./types";
export type {
  BlameTab,
  CompareTab,
  DiffTab,
  FileTab,
  HistoryTab,
  RepositoryTab,
  WorkspaceTab,
} from "./types";
