/** Public API of the workspace feature: the open tabs (documents) and the Welcome tab. */
export { WelcomeView } from "./components/WelcomeView";
export { TAB_HOTKEYS, useTabHotkeys } from "./hooks/useTabHotkeys";
export {
  DIFF_TAB,
  FILE_TAB,
  SETTINGS_TAB,
  WELCOME_TAB,
  showDiffTab,
  showFileTab,
  useActiveRepositoryTab,
  useActiveTab,
  useTabsStore,
} from "./store/tabs";
export { isWorkspaceTab } from "./types";
export type { DiffTab, FileTab, RepositoryTab, WorkspaceTab } from "./types";
