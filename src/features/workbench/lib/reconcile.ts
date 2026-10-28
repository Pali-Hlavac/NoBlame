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
    position?: { referenceGroup: string; direction: "within" };
  }) => unknown;
}

/** Adds missing tabs, closes panels whose tab is gone, syncs titles and the active tab. */
export function reconcileDocuments(
  api: DockApiLike,
  tabs: readonly WorkspaceTab[],
  activeTabId: string | null,
): void {
  const open = new Set(tabs.map((tab) => tab.id));
  for (const panel of [...api.panels]) {
    if (!open.has(panel.id)) panel.api.close();
  }
  for (const tab of tabs) {
    const panel = api.getPanel(tab.id);
    if (!panel) {
      // Without a position dockview opens a new group beside the others; tabs belong in the
      // group the user is working in.
      const group = api.activeGroup ?? api.groups[0];
      api.addPanel({
        id: tab.id,
        component: DOCUMENT_COMPONENT,
        title: tab.title,
        params: { tab },
        inactive: tab.id !== activeTabId,
        ...(group && { position: { referenceGroup: group.id, direction: "within" } }),
      });
    } else if (panel.title !== tab.title) {
      panel.api.setTitle(tab.title);
    }
  }
  if (activeTabId && api.activePanel?.id !== activeTabId) {
    api.getPanel(activeTabId)?.api.setActive();
  }
}
