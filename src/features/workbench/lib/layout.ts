/**
 * The saved workbench layout: both docks as dockview serialized them, plus the sidebar. The
 * backend stores it as an opaque value; this module owns its shape and version.
 */
import type { SerializedDockview } from "dockview-react";

import { isWorkspaceTab, type WorkspaceTab } from "@/features/workspace";

import { parseActivityBar, type ActivityBarLayout } from "./activityBar";
import { parseStacks, type ModuleStack } from "./stacks";

/** Bump when the shape changes incompatibly; older layouts are then ignored (default layout). */
export const LAYOUT_VERSION = 1;

/** Sidebar (module dock) width in pixels on first start and after "Reset layout". */
export const DEFAULT_SIDEBAR_WIDTH_PX = 300;

export interface SidebarLayout {
  widthPx: number;
  collapsed: boolean;
}

export interface SavedLayout {
  version: typeof LAYOUT_VERSION;
  /** The module dock (left). */
  modules: SerializedDockview | null;
  /** The document dock (main area): open tabs and how they are split. */
  documents: SerializedDockview | null;
  sidebar: SidebarLayout;
  /** Modules popped out of the dock (they open in a popup). Missing in older layouts. */
  popouts: string[];
  /** Modules shown together in one tab. Missing in older layouts. */
  stacks: ModuleStack[];
  /** The activity bar's order, hidden icons and lock. Missing in older layouts. */
  activityBar: ActivityBarLayout;
}

/** Panel parameters of a document panel. */
export interface DocumentParams {
  tab: WorkspaceTab;
}

/** Panel parameters of a module panel (a stack's panel: its first module). */
export interface ModuleParams {
  moduleId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Light structural check: dockview validates the rest and throws on garbage. */
function isSerializedDock(value: unknown): value is SerializedDockview {
  return isRecord(value) && isRecord(value.grid) && isRecord(value.panels);
}

function parseSidebar(value: unknown): SidebarLayout {
  const sidebar = isRecord(value) ? value : {};
  return {
    widthPx:
      typeof sidebar.widthPx === "number" && sidebar.widthPx > 0
        ? sidebar.widthPx
        : DEFAULT_SIDEBAR_WIDTH_PX,
    collapsed: sidebar.collapsed === true,
  };
}

/** Accepts a layout read from disk, or returns `null` (unknown version, damaged, missing). */
export function parseSavedLayout(value: unknown): SavedLayout | null {
  if (!isRecord(value) || value.version !== LAYOUT_VERSION) return null;
  return {
    version: LAYOUT_VERSION,
    modules: isSerializedDock(value.modules) ? value.modules : null,
    documents: isSerializedDock(value.documents) ? value.documents : null,
    sidebar: parseSidebar(value.sidebar),
    popouts: Array.isArray(value.popouts)
      ? value.popouts.filter((id): id is string => typeof id === "string")
      : [],
    stacks: parseStacks(value.stacks),
    activityBar: parseActivityBar(value.activityBar),
  };
}

/**
 * The tabs of a saved document dock and the one that was active, or `null` when any panel is
 * not a valid tab (then the whole dock falls back to the default).
 */
export function tabsOfDocuments(
  documents: SerializedDockview,
): { tabs: WorkspaceTab[]; activeTabId: string | null } | null {
  const tabs: WorkspaceTab[] = [];
  for (const panel of Object.values(documents.panels)) {
    const params: unknown = panel.params;
    if (!isRecord(params) || !isWorkspaceTab(params.tab) || params.tab.id !== panel.id) {
      return null;
    }
    tabs.push(params.tab);
  }
  return { tabs, activeTabId: documents.activeGroup ? activePanelOf(documents) : null };
}

function activePanelOf(documents: SerializedDockview): string | null {
  const groups: unknown[] = [];
  const visit = (node: unknown): void => {
    if (!isRecord(node)) return;
    if (node.type === "leaf") groups.push(node.data);
    else if (Array.isArray(node.data)) node.data.forEach(visit);
  };
  visit(documents.grid.root);
  for (const group of groups) {
    if (isRecord(group) && group.id === documents.activeGroup) {
      return typeof group.activeView === "string" ? group.activeView : null;
    }
  }
  return null;
}
