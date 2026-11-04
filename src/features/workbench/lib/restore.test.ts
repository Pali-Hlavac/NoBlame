import type { SerializedDockview } from "dockview-react";

import { WELCOME_TAB, useTabsStore } from "@/features/workspace";

import { useWorkbenchStore } from "../store/workbench";
import { LAYOUT_VERSION, type SavedLayout } from "./layout";
import { restoreWorkbench } from "./restore";

const repo = { id: "repo:/r", kind: "repository", title: "r", path: "/r" } as const;

function savedLayout(): SavedLayout {
  const documents = {
    grid: {
      root: {
        type: "branch",
        data: [{ type: "leaf", data: { id: "1", views: [repo.id], activeView: repo.id }, size: 1 }],
      },
      width: 1,
      height: 1,
      orientation: "HORIZONTAL",
    },
    panels: { [repo.id]: { id: repo.id, contentComponent: "document", params: { tab: repo } } },
    activeGroup: "1",
  } as unknown as SerializedDockview;
  return {
    version: LAYOUT_VERSION,
    modules: null,
    documents,
    sidebar: { collapsed: false, widthPx: 280 },
    popouts: ["commit"],
  };
}

describe("restoreWorkbench", () => {
  beforeEach(() => {
    useTabsStore.getState().replaceTabs([WELCOME_TAB], WELCOME_TAB.id);
  });

  it("restores the saved tabs", () => {
    const saved = savedLayout();
    expect(restoreWorkbench(saved)).toBe(saved);
    expect(useTabsStore.getState().tabs).toEqual([repo]);
    expect(useWorkbenchStore.getState().poppedOut).toEqual(["commit"]);
  });

  it("applies a layout once, so a remount keeps the tabs opened since", () => {
    const saved = savedLayout();
    restoreWorkbench(saved);
    useTabsStore.getState().openTab(WELCOME_TAB);
    expect(restoreWorkbench(saved)).toBe(saved);
    expect(useTabsStore.getState().tabs.map((tab) => tab.id)).toEqual([repo.id, WELCOME_TAB.id]);
  });
});
