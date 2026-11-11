/** Public API of the workspace feature: the open tabs (documents) and the Welcome tab. */
export { WelcomeView } from "./components/WelcomeView";
export { useTabHotkeys } from "./hooks/useTabHotkeys";
export {
  BLAME_TAB,
  COMPARE_TAB,
  DIFF_TAB,
  FILE_TAB,
  HISTORY_TAB,
  MERGE_TAB,
  SETTINGS_TAB,
  STASH_TAB,
  WELCOME_TAB,
  showBlameTab,
  showCompareTab,
  showDiffTab,
  showFileTab,
  setCloseFallback,
  showHistoryTab,
  showMergeTab,
  showStashTab,
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
  MergeTab,
  RepositoryTab,
  StashTab,
  WorkspaceTab,
} from "./types";
