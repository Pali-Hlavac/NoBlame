/** Public API of the workspace feature: the open tabs (documents) and the Welcome tab. */
export { WelcomeView } from "./components/WelcomeView";
export { TAB_HOTKEYS, useTabHotkeys } from "./hooks/useTabHotkeys";
export { WELCOME_TAB, useActiveRepositoryTab, useActiveTab, useTabsStore } from "./store/tabs";
export { isWorkspaceTab } from "./types";
export type { RepositoryTab, WorkspaceTab } from "./types";
