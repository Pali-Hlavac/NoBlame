/**
 * The two docks' dockview APIs, available once they are ready, and the operations other parts
 * of the app run on them (open a module, save the layout). Lives outside React so commands and
 * hotkeys can use it without prop drilling.
 */
import type { DockviewApi } from "dockview-react";

import { saveLayout } from "../api/layout";
import { useWorkbenchStore } from "../store/workbench";
import type { WorkbenchModule } from "../types";
import { LAYOUT_VERSION, type ModuleParams, type SavedLayout } from "./layout";

/** Component name of module panels in the module dock. */
export const MODULE_COMPONENT = "module";

/** Wait this long after the last layout change before writing it to disk. */
const SAVE_DELAY_MS = 500;

export const docks: { modules: DockviewApi | null; documents: DockviewApi | null } = {
  modules: null,
  documents: null,
};

/** Current layout of both docks and the sidebar. */
export function snapshotLayout(): SavedLayout {
  const { sidebarCollapsed, sidebarWidthPx } = useWorkbenchStore.getState();
  return {
    version: LAYOUT_VERSION,
    modules: docks.modules?.toJSON() ?? null,
    documents: docks.documents?.toJSON() ?? null,
    sidebar: { widthPx: sidebarWidthPx, collapsed: sidebarCollapsed },
  };
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** Saves the layout shortly after the last change (drags and resizes fire many events). */
export function scheduleLayoutSave(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveLayout(snapshotLayout()).catch((error: unknown) => {
      console.warn("Saving the workbench layout failed", error);
    });
  }, SAVE_DELAY_MS);
}

/** Forgets the saved layout and rebuilds both docks with the default one. */
export async function resetLayout(): Promise<void> {
  clearTimeout(saveTimer);
  await saveLayout(null);
  useWorkbenchStore.getState().resetLayout();
}

/** Opens the module (or brings it to the front of its group) and shows the sidebar. */
export function openModule(module: Pick<WorkbenchModule, "id" | "title">): void {
  useWorkbenchStore.getState().setSidebarCollapsed(false);
  const api = docks.modules;
  if (!api) return;
  const panel = api.getPanel(module.id);
  if (panel) {
    panel.api.setActive();
    return;
  }
  const params: ModuleParams = { moduleId: module.id };
  // Into the focused group as a tab (without a position dockview would open a new group).
  const group = api.activeGroup ?? api.groups[0];
  api.addPanel({
    id: module.id,
    component: MODULE_COMPONENT,
    title: module.title,
    params,
    ...(group && { position: { referenceGroup: group.id, direction: "within" } }),
  });
}

/**
 * Activity bar click: hides the sidebar when the module is already showing (like VS Code),
 * otherwise opens it.
 */
export function toggleModule(module: Pick<WorkbenchModule, "id" | "title">): void {
  const { sidebarCollapsed, visibleModules, setSidebarCollapsed } = useWorkbenchStore.getState();
  if (!sidebarCollapsed && visibleModules.includes(module.id)) {
    setSidebarCollapsed(true);
    return;
  }
  openModule(module);
}
