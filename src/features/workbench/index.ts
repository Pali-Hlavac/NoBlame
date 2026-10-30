/** Public API of the workbench: activity bar, module dock, document dock and their layout. */
export { useSavedLayout } from "./api/layout";
export { ActivityBarButton } from "./components/ActivityBarButton";
export { Workbench } from "./components/Workbench";
export { WorkbenchToolbar } from "./components/WorkbenchToolbar";
export { REGION_HOTKEYS } from "./hooks/useWorkbenchHotkeys";
export { openModule, openModuleById, resetLayout } from "./lib/docks";
export type { SavedLayout } from "./lib/layout";
export type { ToolbarAction, WorkbenchModule } from "./types";
