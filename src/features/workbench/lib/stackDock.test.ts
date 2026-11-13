import type { DockviewApi } from "dockview-react";
import { FileIcon } from "lucide-react";

import { useWorkbenchStore } from "../store/workbench";
import type { WorkbenchModule } from "../types";
import { docks, keepLayout } from "./docks";
import { syncStacks } from "./stackDock";

const module = (id: string): WorkbenchModule => ({
  id,
  title: id.toUpperCase(),
  icon: FileIcon,
  component: () => null,
});

interface FakePanel {
  id: string;
  title: string;
  group: FakeGroup;
  api: { close: () => void };
}
interface FakeGroup {
  id: string;
  activePanel: FakePanel | undefined;
}

/** Just enough of dockview for `syncStacks`: one group, panels added and closed in it. */
function fakeDock(ids: string[], active: string) {
  const group: FakeGroup = { id: "g1", activePanel: undefined };
  const panels: FakePanel[] = [];
  const add = (id: string, title = id) => {
    const panel: FakePanel = {
      id,
      title,
      group,
      api: {
        close: () => {
          panels.splice(panels.indexOf(panel), 1);
        },
      },
    };
    panels.push(panel);
    return panel;
  };
  ids.forEach((id) => add(id));
  group.activePanel = panels.find((panel) => panel.id === active);
  const api = {
    get panels() {
      return panels;
    },
    groups: [group],
    activeGroup: group,
    getPanel: (id: string) => panels.find((panel) => panel.id === id),
    addPanel: (options: { id: string; title: string; position?: { referenceGroup: string } }) => {
      expect(options.position?.referenceGroup).toBe("g1");
      add(options.id, options.title);
    },
  };
  return { api: api as unknown as DockviewApi, panels };
}

describe("syncStacks", () => {
  beforeEach(() => {
    keepLayout(false);
    docks.registered = ["a", "b", "c"].map(module);
  });

  it("moves stacked modules into their stack's tab", () => {
    useWorkbenchStore.setState({ stacks: [{ modules: ["a", "b"], sizes: null }] });
    const { api, panels } = fakeDock(["a", "b", "c"], "a");
    syncStacks(api);
    expect(panels.map((panel) => [panel.id, panel.title])).toEqual([
      ["c", "c"],
      ["stack:a+b", "A + B"],
    ]);
  });

  it("gives an ended stack's modules their own tabs again", () => {
    useWorkbenchStore.setState({ stacks: [] });
    const { api, panels } = fakeDock(["stack:a+b", "c"], "stack:a+b");
    syncStacks(api);
    expect(panels.map((panel) => panel.id)).toEqual(["c", "a", "b"]);
  });

  it("leaves out modules the app no longer has", () => {
    useWorkbenchStore.setState({ stacks: [] });
    const { api, panels } = fakeDock(["stack:a+gone"], "stack:a+gone");
    syncStacks(api);
    expect(panels.map((panel) => panel.id)).toEqual(["a"]);
  });
});
