/** Applies a saved layout's non-dock parts (open tabs, sidebar) before the docks mount. */
import { useTabsStore } from "@/features/workspace";

import { useWorkbenchStore } from "../store/workbench";
import { tabsOfDocuments, type SavedLayout } from "./layout";

/**
 * Restores the tabs and the sidebar from `saved`, and returns the layout the docks should use:
 * without the document dock when its tabs could not be read (the default arrangement then).
 * Idempotent, so React StrictMode may call it twice.
 */
export function restoreWorkbench(saved: SavedLayout | null): SavedLayout | null {
  if (!saved) return null;
  useWorkbenchStore.setState({
    sidebarCollapsed: saved.sidebar.collapsed,
    sidebarWidthPx: saved.sidebar.widthPx,
  });
  const restored = saved.documents ? tabsOfDocuments(saved.documents) : null;
  if (!restored) return { ...saved, documents: null };
  useTabsStore.getState().replaceTabs(restored.tabs, restored.activeTabId);
  return saved;
}
