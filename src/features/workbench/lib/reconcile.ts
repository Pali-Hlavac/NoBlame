/**
 * Keeps the document dock in step with the tabs store. The store decides *which* tabs are open
 * and which is active; dockview decides *where* they are docked. Reconciling is idempotent, so
 * running it after every store change (and after restoring a layout) is safe.
 */
import type { WorkspaceTab } from "@/features/workspace";

import type { DocumentParams } from "./layout";

/** Component name of document panels in the document dock. */
export const DOCUMENT_COMPONENT = "document";

/** The part of a dockview panel that reconciling needs (lets tests use plain objects). */
export interface DockPanelLike {
  id: string;
  title: string | undefined;
  /** The group the panel is docked in. */
  group?: { id: string };
  api: { setActive: () => void; setTitle: (title: string) => void; close: () => void };
}

/** The part of the dockview API that reconciling needs. */
export interface DockApiLike {
  panels: readonly DockPanelLike[];
  activePanel: DockPanelLike | undefined;
  /** Group with focus; new tabs open in it. */
  activeGroup: { id: string } | undefined;
  /** All groups; the first one is used when none has focus yet (at start-up). */
  groups: readonly { id: string }[];
  getPanel: (id: string) => DockPanelLike | undefined;
  addPanel: (options: {
    id: string;
    component: string;
    title: string;
    params: DocumentParams;
    inactive: boolean;
    position?: Position;
  }) => unknown;
}

type Position =
  { referenceGroup: string; direction: "within" } | { referencePanel: string; direction: "right" };

/** Tabs that show what a module chose (the diff, a file): they open beside the graph. */
function isViewer(tab: WorkspaceTab): boolean {
  return tab.kind === "diff" || tab.kind === "file";
}

/**
 * Where a new tab opens. The diff and file tabs open together: in the group of the other one
 * if it is open, else to the right of the active repository's tab, so the graph stays visible
 * beside them. Other tabs open in the group the user is working in, but not in that viewer
 * group: they would hide the diff. (Without a position dockview opens a new group.)
 */
function positionFor(
  api: DockApiLike,
  tab: WorkspaceTab,
  tabs: readonly WorkspaceTab[],
  activeRepositoryTabId: string | null,
): Position | undefined {
  const repository = activeRepositoryTabId ? api.getPanel(activeRepositoryTabId) : undefined;
  const viewer = tabs.find((open) => open.id !== tab.id && isViewer(open));
  const viewerGroup = viewer ? api.getPanel(viewer.id)?.group?.id : undefined;
  if (isViewer(tab)) {
    if (viewerGroup) return { referenceGroup: viewerGroup, direction: "within" };
    if (repository) return { referencePanel: repository.id, direction: "right" };
  }
  let group = api.activeGroup ?? api.groups[0];
  if (group && group.id === viewerGroup) {
    group = repository?.group ?? api.groups.find((other) => other.id !== viewerGroup) ?? group;
  }
  return group && { referenceGroup: group.id, direction: "within" };
}

/** Adds missing tabs, closes panels whose tab is gone, syncs titles and the active tab. */
export function reconcileDocuments(
  api: DockApiLike,
  tabs: readonly WorkspaceTab[],
  activeTabId: string | null,
  activeRepositoryTabId: string | null = null,
): void {
  const open = new Set(tabs.map((tab) => tab.id));
  for (const panel of [...api.panels]) {
    if (!open.has(panel.id)) panel.api.close();
  }
  for (const tab of tabs) {
    const panel = api.getPanel(tab.id);
    if (!panel) {
      const position = positionFor(api, tab, tabs, activeRepositoryTabId);
      api.addPanel({
        id: tab.id,
        component: DOCUMENT_COMPONENT,
        title: tab.title,
        params: { tab },
        inactive: tab.id !== activeTabId,
        ...(position && { position }),
      });
    } else if (panel.title !== tab.title) {
      panel.api.setTitle(tab.title);
    }
  }
  if (activeTabId && api.activePanel?.id !== activeTabId) {
    api.getPanel(activeTabId)?.api.setActive();
  }
}
