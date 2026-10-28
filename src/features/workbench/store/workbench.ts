/** UI state of the workbench frame (sidebar and which modules are showing). */
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
  /** Bumped by "Reset layout"; the docks remount with the default layout. */
  layoutEpoch: number;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (widthPx: number) => void;
  setModules: (open: string[], visible: string[]) => void;
  resetLayout: () => void;
}

export const useWorkbenchStore = create<WorkbenchState>()((set) => ({
  sidebarCollapsed: false,
  sidebarWidthPx: DEFAULT_SIDEBAR_WIDTH_PX,
  openModules: [],
  visibleModules: [],
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
  resetLayout: () => {
    set((state) => ({
      sidebarCollapsed: false,
      sidebarWidthPx: DEFAULT_SIDEBAR_WIDTH_PX,
      layoutEpoch: state.layoutEpoch + 1,
    }));
  },
}));
