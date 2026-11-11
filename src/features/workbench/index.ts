/**
 * Public API of the workbench: activity bar, module dock (and popped-out modules), document dock
 * and their layout.
 */
export { useSavedLayout } from "./api/layout";
export { ActivityBarButton } from "./components/ActivityBarButton";
export { Workbench } from "./components/Workbench";
export { WorkbenchToolbar } from "./components/WorkbenchToolbar";
export { useModuleHost, type ModuleHost } from "./hooks/useModuleHost";
export { useModulePopupOpen } from "./hooks/useModulePopupOpen";
export { openModule, openModuleById, resetLayout } from "./lib/docks";
export type { SavedLayout } from "./lib/layout";
export type { ToolbarAction, WorkbenchModule } from "./types";
