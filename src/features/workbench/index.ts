/** Public API of the workbench: activity bar, module dock, document dock and their layout. */
export { useSavedLayout } from "./api/layout";
export { Workbench } from "./components/Workbench";
export { REGION_HOTKEYS } from "./hooks/useWorkbenchHotkeys";
export { openModule, resetLayout } from "./lib/docks";
export type { SavedLayout } from "./lib/layout";
export type { WorkbenchModule } from "./types";
