/** Applies a saved layout's non-dock parts (open tabs, sidebar) before the docks mount. */
import { useTabsStore } from "@/features/workspace";

import { useWorkbenchStore } from "../store/workbench";
import { tabsOfDocuments, type SavedLayout } from "./layout";

/** Layouts already applied, with what the docks were given. */
const applied = new WeakMap<SavedLayout, SavedLayout>();

/**
 * Restores the tabs and the sidebar from `saved`, and returns the layout the docks should use:
 * without the document dock when its tabs could not be read (the default arrangement then).
 *
 * Each layout is applied once; calling again with it returns the same result and changes
 * nothing. So StrictMode's double render is harmless, and a remount (a hot reload in
 * development) keeps the tabs opened since: the document dock reconciles to them.
 */
export function restoreWorkbench(saved: SavedLayout | null): SavedLayout | null {
  if (!saved) return null;
  const earlier = applied.get(saved);
  if (earlier) return earlier;
  const result = apply(saved);
  applied.set(saved, result);
  return result;
}

function apply(saved: SavedLayout): SavedLayout {
  useWorkbenchStore.setState({
    sidebarCollapsed: saved.sidebar.collapsed,
    sidebarWidthPx: saved.sidebar.widthPx,
  });
  const restored = saved.documents ? tabsOfDocuments(saved.documents) : null;
  if (!restored) return { ...saved, documents: null };
  useTabsStore.getState().replaceTabs(restored.tabs, restored.activeTabId);
  return saved;
}
