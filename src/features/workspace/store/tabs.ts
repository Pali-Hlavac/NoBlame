/**
 * Zustand store for the open documents (tabs) and which one is active. This is the source of
 * truth for *what* is open; where each tab is docked belongs to the workbench layout.
 */
import { create } from "zustand";

import type {
  DiffTab,
  FileTab,
  HistoryTab,
  RepositoryTab,
  SettingsTab,
  WelcomeTab,
  WorkspaceTab,
} from "../types";

export const WELCOME_TAB: WelcomeTab = { id: "welcome", kind: "welcome", title: "Welcome" };
export const SETTINGS_TAB: SettingsTab = { id: "settings", kind: "settings", title: "Settings" };
export const DIFF_TAB: DiffTab = { id: "diff", kind: "diff", title: "Diff" };
export const FILE_TAB: FileTab = { id: "file", kind: "file", title: "File" };
export const HISTORY_TAB: HistoryTab = { id: "history", kind: "history", title: "History" };

interface TabsState {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  /**
   * The repository tab focused most recently ("active repository"). Stays set while a
   * non-repository tab (for example the diff) is focused, so modules keep following it.
   */
  activeRepositoryTabId: string | null;
  /** Opens the tab, or focuses it if a tab with the same id is already open. */
  openTab: (tab: WorkspaceTab) => void;
  /**
   * Closes the tab. When it was active, `nextActiveId` (what the dock focused instead) or else
   * its right neighbor (or the new last tab) becomes active.
   */
  closeTab: (id: string, nextActiveId?: string | null) => void;
  activateTab: (id: string) => void;
  /** Renames an open tab (the diff tab names its file). */
  setTitle: (id: string, title: string) => void;
  /** Moves the active tab by `offset`, wrapping around at both ends. */
  cycleTab: (offset: number) => void;
  /** Replaces every tab, for example with the tabs of a restored layout. */
  replaceTabs: (tabs: WorkspaceTab[], activeTabId: string | null) => void;
}

/** The repository tab that should be the active repository after `activeTabId` changes. */
function nextRepositoryTab(
  tabs: readonly WorkspaceTab[],
  activeTabId: string | null,
  previous: string | null,
): string | null {
  const active = tabs.find((tab) => tab.id === activeTabId);
  if (active?.kind === "repository") return active.id;
  if (previous && tabs.some((tab) => tab.id === previous)) return previous;
  return tabs.find((tab) => tab.kind === "repository")?.id ?? null;
}

export const useTabsStore = create<TabsState>()((set) => ({
  tabs: [WELCOME_TAB],
  activeTabId: WELCOME_TAB.id,
  activeRepositoryTabId: null,

  openTab: (tab) => {
    set((state) => {
      const tabs = state.tabs.some((open) => open.id === tab.id)
        ? state.tabs
        : [...state.tabs, tab];
      return {
        tabs,
        activeTabId: tab.id,
        activeRepositoryTabId: nextRepositoryTab(tabs, tab.id, state.activeRepositoryTabId),
      };
    });
  },

  closeTab: (id, nextActiveId) => {
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === id);
      if (index === -1) return state;
      const tabs = state.tabs.filter((tab) => tab.id !== id);
      let activeTabId = state.activeTabId;
      if (activeTabId === id) {
        const preferred = tabs.find((tab) => tab.id === nextActiveId);
        activeTabId = (preferred ?? tabs[Math.min(index, tabs.length - 1)])?.id ?? null;
      }
      return {
        tabs,
        activeTabId,
        activeRepositoryTabId: nextRepositoryTab(tabs, activeTabId, state.activeRepositoryTabId),
      };
    });
  },

  activateTab: (id) => {
    set((state) => ({
      activeTabId: id,
      activeRepositoryTabId: nextRepositoryTab(state.tabs, id, state.activeRepositoryTabId),
    }));
  },

  setTitle: (id, title) => {
    set((state) => {
      const tab = state.tabs.find((open) => open.id === id);
      if (!tab || tab.title === title) return state;
      return { tabs: state.tabs.map((open) => (open === tab ? { ...open, title } : open)) };
    });
  },

  cycleTab: (offset) => {
    set((state) => {
      const count = state.tabs.length;
      if (count === 0) return state;
      const current = state.tabs.findIndex((tab) => tab.id === state.activeTabId);
      const next = state.tabs[(((current + offset) % count) + count) % count]?.id ?? null;
      return {
        activeTabId: next,
        activeRepositoryTabId: nextRepositoryTab(state.tabs, next, state.activeRepositoryTabId),
      };
    });
  },

  replaceTabs: (tabs, activeTabId) => {
    const active = tabs.some((tab) => tab.id === activeTabId) ? activeTabId : (tabs[0]?.id ?? null);
    set({
      tabs,
      activeTabId: active,
      activeRepositoryTabId: nextRepositoryTab(tabs, active, null),
    });
  },
}));

/** Shows the diff tab: opens it the first time, otherwise focuses it where it is docked. */
export function showDiffTab(): void {
  useTabsStore.getState().openTab(DIFF_TAB);
}

/** Shows the file tab: opens it the first time, otherwise focuses it where it is docked. */
export function showFileTab(): void {
  useTabsStore.getState().openTab(FILE_TAB);
}

/** Shows the history tab: opens it the first time, otherwise focuses it where it is docked. */
export function showHistoryTab(): void {
  useTabsStore.getState().openTab(HISTORY_TAB);
}

/** The currently active tab, if any. */
export function useActiveTab(): WorkspaceTab | undefined {
  return useTabsStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId));
}

/** The active repository's tab: the repository tab focused most recently. */
export function useActiveRepositoryTab(): RepositoryTab | undefined {
  return useTabsStore((state) => {
    const tab = state.tabs.find((open) => open.id === state.activeRepositoryTabId);
    return tab?.kind === "repository" ? tab : undefined;
  });
}
