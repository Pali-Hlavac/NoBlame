import type { WorkspaceTab } from "../types";

import { WELCOME_TAB, setCloseFallback, useTabsStore } from "./tabs";

const tab = (id: string): WorkspaceTab => ({ id, kind: "welcome", title: id });
const repo = (id: string): WorkspaceTab => ({
  id,
  kind: "repository",
  title: id,
  path: `/r/${id}`,
});
const state = () => useTabsStore.getState();

beforeEach(() => {
  useTabsStore.setState({
    tabs: [WELCOME_TAB],
    activeTabId: WELCOME_TAB.id,
    activeRepositoryTabId: null,
    recent: [WELCOME_TAB.id],
  });
});

describe("tabs store", () => {
  it("opens and activates a new tab", () => {
    state().openTab(tab("a"));
    expect(state().tabs.map((t) => t.id)).toEqual(["welcome", "a"]);
    expect(state().activeTabId).toBe("a");
  });

  it("renames an open tab and ignores unknown ones", () => {
    state().openTab(tab("a"));
    state().setTitle("a", "Diff: main.rs");
    state().setTitle("missing", "x");
    expect(state().tabs.map((t) => t.title)).toEqual(["Welcome", "Diff: main.rs"]);
  });

  it("focuses instead of duplicating an already open tab", () => {
    state().openTab(tab("a"));
    state().openTab(WELCOME_TAB);
    expect(state().tabs).toHaveLength(2);
    expect(state().activeTabId).toBe("welcome");
  });

  it("activates the tab used before when closing the active tab", () => {
    state().openTab(tab("a"));
    state().openTab(tab("b"));
    state().openTab(tab("c"));
    state().activateTab("a");
    state().closeTab("a");
    expect(state().activeTabId).toBe("c");
    expect(state().recent).toEqual(["c", "b", "welcome"]);
  });

  it("keeps the order of use when the tabs are replaced (a layout restored)", () => {
    state().openTab(tab("a"));
    state().openTab(tab("b"));
    state().replaceTabs([tab("b"), tab("x"), tab("a")], "a");
    expect(state().recent).toEqual(["a", "b", "x"]);
  });

  it("falls back to the last tab when closing the active last tab", () => {
    state().openTab(tab("a"));
    state().closeTab("a");
    expect(state().activeTabId).toBe("welcome");
  });

  it("keeps the active tab when closing another one", () => {
    state().openTab(tab("a"));
    state().closeTab("welcome");
    expect(state().activeTabId).toBe("a");
  });

  it("clears the active tab when the last tab closes", () => {
    state().closeTab("welcome");
    expect(state().tabs).toEqual([]);
    expect(state().activeTabId).toBeNull();
  });

  it("cycles with wrap-around in both directions", () => {
    state().openTab(tab("a"));
    state().cycleTab(1);
    expect(state().activeTabId).toBe("welcome");
    state().cycleTab(-1);
    expect(state().activeTabId).toBe("a");
  });

  it("activates what the dock focused when it closes the active tab", () => {
    state().openTab(tab("a"));
    state().openTab(tab("b"));
    state().activateTab("a");
    state().closeTab("a", "welcome");
    expect(state().activeTabId).toBe("welcome");
  });

  it("asks the registered fallback when the caller names no next tab", () => {
    state().openTab(tab("a"));
    state().openTab(tab("b"));
    state().activateTab("a");
    setCloseFallback(() => "welcome");
    try {
      state().closeTab("a");
    } finally {
      setCloseFallback(null);
    }
    expect(state().activeTabId).toBe("welcome");
  });

  it("replaces all tabs, falling back to the first when the active one is unknown", () => {
    state().replaceTabs([tab("x"), repo("y")], "missing");
    expect(state().tabs.map((t) => t.id)).toEqual(["x", "y"]);
    expect(state().activeTabId).toBe("x");
    expect(state().activeRepositoryTabId).toBe("y");
  });
});

describe("active repository", () => {
  it("follows the focused repository tab and stays while another kind is focused", () => {
    state().openTab(repo("r1"));
    state().openTab(repo("r2"));
    expect(state().activeRepositoryTabId).toBe("r2");
    state().activateTab("welcome");
    expect(state().activeRepositoryTabId).toBe("r2");
    state().activateTab("r1");
    expect(state().activeRepositoryTabId).toBe("r1");
  });

  it("moves to another repository tab when its tab closes", () => {
    state().openTab(repo("r1"));
    state().openTab(repo("r2"));
    state().activateTab("welcome");
    state().closeTab("r2");
    expect(state().activeRepositoryTabId).toBe("r1");
    state().closeTab("r1");
    expect(state().activeRepositoryTabId).toBeNull();
  });
});
