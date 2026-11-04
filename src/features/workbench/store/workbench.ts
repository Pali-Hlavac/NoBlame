/** UI state of the workbench frame (sidebar, which modules are showing, popped-out modules). */
import { create } from "zustand";

import { DEFAULT_SIDEBAR_WIDTH_PX } from "../lib/layout";

interface WorkbenchState {
  /** The module dock is hidden (the activity bar stays). */
  sidebarCollapsed: boolean;
  sidebarWidthPx: number;
  /** Modules open in the module dock. */
  openModules: string[];
  /** Modules in front of their dock group, i.e. visible. */
  visibleModules: string[];
  /** Modules the user popped out: they open in a popup over the window, not in the dock. */
  poppedOut: string[];
  /** The popped-out module showing in its popup, if any. */
  popup: string | null;
  /** Popped-out modules shown at least once: their popups stay mounted (and keep state). */
  mountedPopups: string[];
  /** Bumped by "Reset layout"; the docks remount with the default layout. */
  layoutEpoch: number;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (widthPx: number) => void;
  setModules: (open: string[], visible: string[]) => void;
  /** Marks a module as popped out and shows its popup. */
  popOut: (id: string) => void;
  /** Takes a module back into the dock (its popup closes). */
  dock: (id: string) => void;
  showPopup: (id: string) => void;
  closePopup: () => void;
  resetLayout: () => void;
}

function withId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids : [...ids, id];
}

export const useWorkbenchStore = create<WorkbenchState>()((set) => ({
  sidebarCollapsed: false,
  sidebarWidthPx: DEFAULT_SIDEBAR_WIDTH_PX,
  openModules: [],
  visibleModules: [],
  poppedOut: [],
  popup: null,
  mountedPopups: [],
  layoutEpoch: 0,
  setSidebarCollapsed: (sidebarCollapsed) => {
    set({ sidebarCollapsed });
  },
  setSidebarWidth: (sidebarWidthPx) => {
    set({ sidebarWidthPx });
  },
  setModules: (openModules, visibleModules) => {
    set({ openModules, visibleModules });
  },
  popOut: (id) => {
    set((state) => ({
      poppedOut: withId(state.poppedOut, id),
      popup: id,
      mountedPopups: withId(state.mountedPopups, id),
    }));
  },
  dock: (id) => {
    set((state) => ({
      poppedOut: state.poppedOut.filter((popped) => popped !== id),
      popup: state.popup === id ? null : state.popup,
      mountedPopups: state.mountedPopups.filter((mounted) => mounted !== id),
    }));
  },
  showPopup: (popup) => {
    set((state) => ({ popup, mountedPopups: withId(state.mountedPopups, popup) }));
  },
  closePopup: () => {
    set({ popup: null });
  },
  resetLayout: () => {
    set((state) => ({
      sidebarCollapsed: false,
      sidebarWidthPx: DEFAULT_SIDEBAR_WIDTH_PX,
      poppedOut: [],
      popup: null,
      mountedPopups: [],
      layoutEpoch: state.layoutEpoch + 1,
    }));
  },
}));
