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
});
