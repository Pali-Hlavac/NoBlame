/**
 * The two docks' dockview APIs, available once they are ready, and the operations other parts
 * of the app run on them (open a module, save the layout). Lives outside React so commands and
 * hotkeys can use it without prop drilling.
 */
import type { DockviewApi, DockviewGroupPanel } from "dockview-react";

import { saveLayout } from "../api/layout";
import { useWorkbenchStore } from "../store/workbench";
import type { WorkbenchModule } from "../types";
import { LAYOUT_VERSION, type ModuleParams, type SavedLayout } from "./layout";
import { idsOfStackPanel, isStackPanelId, panelIdOf } from "./stacks";

/** Component name of module panels in the module dock. */
export const MODULE_COMPONENT = "module";

/** Wait this long after the last layout change before writing it to disk. */
const SAVE_DELAY_MS = 500;

export const docks: {
  modules: DockviewApi | null;
  documents: DockviewApi | null;
  /** The modules the workbench was given, so features can open one by id. */
  registered: readonly WorkbenchModule[];
  /** The layout is saved (the main window); a task window's never is. */
  persist: boolean;
} = {
  modules: null,
  documents: null,
  registered: [],
  persist: true,
};

/** Current layout of both docks and the sidebar. */
export function snapshotLayout(): SavedLayout {
  const { sidebarCollapsed, sidebarWidthPx, poppedOut, stacks, activityBar } =
    useWorkbenchStore.getState();
  return {
    version: LAYOUT_VERSION,
    modules: docks.modules?.toJSON() ?? null,
    documents: docks.documents?.toJSON() ?? null,
    sidebar: { widthPx: sidebarWidthPx, collapsed: sidebarCollapsed },
    popouts: poppedOut,
    stacks,
    activityBar,
  };
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** Opens the sidebar at `widthPx` (a task window's, before the workbench first lays out). */
export function presetSidebar(widthPx: number): void {
  useWorkbenchStore.setState({ sidebarWidthPx: widthPx, sidebarCollapsed: false });
}

/** Whether layout changes are saved: the main window's are, a task window's never. */
export function keepLayout(persist: boolean): void {
  docks.persist = persist;
}

/** Saves the layout shortly after the last change (drags and resizes fire many events). */
export function scheduleLayoutSave(): void {
  clearTimeout(saveTimer);
  if (!docks.persist) return;
  saveTimer = setTimeout(() => {
    saveLayout(snapshotLayout()).catch((error: unknown) => {
      console.warn("Saving the workbench layout failed", error);
    });
  }, SAVE_DELAY_MS);
}

/** Forgets the saved layout and rebuilds both docks with the default one. */
export async function resetLayout(): Promise<void> {
  clearTimeout(saveTimer);
  if (docks.persist) await saveLayout(null);
  useWorkbenchStore.getState().resetLayout();
}

function titleOf(moduleId: string): string | undefined {
  return docks.registered.find((module) => module.id === moduleId)?.title;
}

/** A dock panel's title: the module's, or its stack's modules joined with "+". */
export function panelTitle(panelId: string): string {
  const ids = isStackPanelId(panelId) ? idsOfStackPanel(panelId) : [panelId];
  return ids.map((id) => titleOf(id) ?? id).join(" + ");
}

/** Opens the panel `panelId` (a module or a stack) as a tab of `group`, or of the focused group. */
export function addModulePanel(
  api: DockviewApi,
  panelId: string,
  group: DockviewGroupPanel | undefined,
  inactive = false,
): void {
  const [first] = isStackPanelId(panelId) ? idsOfStackPanel(panelId) : [panelId];
  if (first === undefined || titleOf(first) === undefined) return;
  const params: ModuleParams = { moduleId: first };
  // Into a group as a tab (without a position dockview would open a new group).
  const target = group ?? api.activeGroup ?? api.groups[0];
  api.addPanel({
    id: panelId,
    component: MODULE_COMPONENT,
    title: panelTitle(panelId),
    params,
    inactive,
    ...(target && { position: { referenceGroup: target.id, direction: "within" } }),
  });
}

/**
 * Opens the module (or its stack, or brings it to the front of its group) and shows the sidebar;
 * a popped-out module shows its popup instead.
 */
export function openModule(module: Pick<WorkbenchModule, "id">): void {
  const store = useWorkbenchStore.getState();
  if (store.poppedOut.includes(module.id)) {
    store.showPopup(module.id);
    return;
  }
  store.setSidebarCollapsed(false);
  const api = docks.modules;
  if (!api) return;
  // A stacked module shows in its stack's tab.
  const id = panelIdOf(store.stacks, module.id);
  const panel = api.getPanel(id);
  if (panel) panel.api.setActive();
  else addModulePanel(api, id, undefined);
}

/**
 * Opens the registered module with this id, for features that cannot import the registry
 * (the app shell imports them). Does nothing for an unknown id.
 */
export function openModuleById(id: string): void {
  const module = docks.registered.find((registered) => registered.id === id);
  if (module) openModule(module);
}

/**
 * Activity bar click: hides the sidebar when the module is already showing (like VS Code),
 * otherwise opens it (a popped-out module in its popup).
 */
export function toggleModule(module: Pick<WorkbenchModule, "id" | "title">): void {
  const { sidebarCollapsed, visibleModules, setSidebarCollapsed } = useWorkbenchStore.getState();
  if (!sidebarCollapsed && visibleModules.includes(module.id)) {
    setSidebarCollapsed(true);
    return;
  }
  openModule(module);
}
