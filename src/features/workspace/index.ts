/** Public API of the workspace (tabs) feature. */
export { WelcomeView } from "./components/WelcomeView";
export { WorkspaceView } from "./components/WorkspaceView";
export { TAB_HOTKEYS } from "./hooks/useTabHotkeys";
export { WELCOME_TAB, useActiveTab, useTabsStore } from "./store/tabs";
export type { RepositoryTab, WorkspaceTab } from "./types";
