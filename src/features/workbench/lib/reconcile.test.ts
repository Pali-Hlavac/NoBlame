import type { WorkspaceTab } from "@/features/workspace";

import { reconcileDocuments, type DockApiLike, type DockPanelLike } from "./reconcile";

/** In-memory stand-in for the dockview API: one group, insertion order. */
function fakeDock(ids: string[] = [], active?: string) {
  const panels: DockPanelLike[] = [];
  let activeId = active;
  const add = (id: string, title = id): void => {
    const panel: DockPanelLike = {
      id,
      title,
      api: {
        setActive: () => {
          activeId = id;
        },
        setTitle: (next) => {
          panel.title = next;
        },
        close: () => {
          panels.splice(panels.indexOf(panel), 1);
        },
      },
    };
    panels.push(panel);
  };
  ids.forEach((id) => {
    add(id);
  });
  const api: DockApiLike = {
    panels,
    activeGroup: undefined,
    groups: [],
    get activePanel() {
      return panels.find((panel) => panel.id === activeId);
    },
    getPanel: (id) => panels.find((panel) => panel.id === id),
    addPanel: (options) => {
      add(options.id, options.title);
      if (!options.inactive || activeId === undefined) activeId = options.id;
    },
  };
  return api;
}

const tab = (id: string, title = id): WorkspaceTab => ({ id, kind: "welcome", title });

describe("reconcileDocuments", () => {
  it("adds missing tabs and activates the active one", () => {
    const dock = fakeDock();
    reconcileDocuments(dock, [tab("a"), tab("b")], "b");
    expect(dock.panels.map((panel) => panel.id)).toEqual(["a", "b"]);
    expect(dock.activePanel?.id).toBe("b");
  });

  it("closes panels whose tab was closed", () => {
    const dock = fakeDock(["a", "b", "c"], "a");
    reconcileDocuments(dock, [tab("a"), tab("c")], "a");
    expect(dock.panels.map((panel) => panel.id)).toEqual(["a", "c"]);
  });

  it("keeps existing panels (and where they are docked) untouched", () => {
    const dock = fakeDock(["b", "a"], "b");
    reconcileDocuments(dock, [tab("a"), tab("b")], "b");
    expect(dock.panels.map((panel) => panel.id)).toEqual(["b", "a"]);
  });

  it("updates changed titles", () => {
    const dock = fakeDock(["a"], "a");
    reconcileDocuments(dock, [tab("a", "Renamed")], "a");
    expect(dock.getPanel("a")?.title).toBe("Renamed");
  });

  it("is idempotent", () => {
    const dock = fakeDock();
    reconcileDocuments(dock, [tab("a"), tab("b")], "a");
    reconcileDocuments(dock, [tab("a"), tab("b")], "a");
    expect(dock.panels).toHaveLength(2);
    expect(dock.activePanel?.id).toBe("a");
  });

  it("opens new tabs in the active group", () => {
    const dock = fakeDock(["a"], "a");
    const added: unknown[] = [];
    const api: DockApiLike = {
      ...dock,
      panels: dock.panels,
      activePanel: dock.activePanel,
      activeGroup: { id: "group-2" },
      addPanel: (options) => {
        added.push(options.position);
      },
    };
    reconcileDocuments(api, [tab("a"), tab("b")], "a");
    expect(added).toEqual([{ referenceGroup: "group-2", direction: "within" }]);
  });

  it("opens the diff tab to the right of the active repository's tab", () => {
    const dock = fakeDock(["repo"], "repo");
    const added: unknown[] = [];
    const api: DockApiLike = {
      ...dock,
      activeGroup: { id: "g1" },
      addPanel: (options) => {
        added.push(options.position);
      },
    };
    const diff: WorkspaceTab = { id: "diff", kind: "diff", title: "Diff" };
    reconcileDocuments(api, [tab("repo"), diff], "diff", "repo");
    expect(added).toEqual([{ referencePanel: "repo", direction: "right" }]);
  });

  it("does not open other tabs in the diff tab's group", () => {
    const dock = fakeDock(["repo", "diff"], "diff");
    for (const panel of dock.panels) panel.group = { id: panel.id === "diff" ? "g2" : "g1" };
    const added: unknown[] = [];
    const api: DockApiLike = {
      ...dock,
      activeGroup: { id: "g2" },
      addPanel: (options) => {
        added.push(options.position);
      },
    };
    const diff: WorkspaceTab = { id: "diff", kind: "diff", title: "Diff" };
    reconcileDocuments(api, [tab("repo"), diff, tab("new")], "diff", "repo");
    expect(added).toEqual([{ referenceGroup: "g1", direction: "within" }]);
  });

  it("opens the file tab in the diff tab's group", () => {
    const dock = fakeDock(["repo", "diff"], "repo");
    for (const panel of dock.panels) panel.group = { id: panel.id === "diff" ? "g2" : "g1" };
    const added: unknown[] = [];
    const api: DockApiLike = {
      ...dock,
      activeGroup: { id: "g1" },
      addPanel: (options) => {
        added.push(options.position);
      },
    };
    const diff: WorkspaceTab = { id: "diff", kind: "diff", title: "Diff" };
    const file: WorkspaceTab = { id: "file", kind: "file", title: "File" };
    reconcileDocuments(api, [tab("repo"), diff, file], "file", "repo");
    expect(added).toEqual([{ referenceGroup: "g2", direction: "within" }]);
  });

  it("opens the compare tab beside the graph, with the diff tab", () => {
    const dock = fakeDock(["repo", "diff"], "repo");
    for (const panel of dock.panels) panel.group = { id: panel.id === "diff" ? "g2" : "g1" };
    const added: unknown[] = [];
    const api: DockApiLike = {
      ...dock,
      activeGroup: { id: "g1" },
      addPanel: (options) => {
        added.push(options.position);
      },
    };
    const diff: WorkspaceTab = { id: "diff", kind: "diff", title: "Diff" };
    const compare: WorkspaceTab = { id: "compare", kind: "compare", title: "Compare" };
    reconcileDocuments(api, [tab("repo"), diff, compare], "compare", "repo");
    expect(added).toEqual([{ referenceGroup: "g2", direction: "within" }]);
  });

  it("uses the first group when none has focus yet", () => {
    const dock = fakeDock();
    const added: unknown[] = [];
    const api: DockApiLike = {
      ...dock,
      panels: dock.panels,
      activePanel: undefined,
      groups: [{ id: "first" }, { id: "second" }],
      addPanel: (options) => {
        added.push(options.position);
      },
    };
    reconcileDocuments(api, [tab("a")], "a");
    expect(added).toEqual([{ referenceGroup: "first", direction: "within" }]);
  });
});
