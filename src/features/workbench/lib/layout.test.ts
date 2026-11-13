import type { SerializedDockview } from "dockview-react";

import {
  DEFAULT_SIDEBAR_WIDTH_PX,
  LAYOUT_VERSION,
  parseSavedLayout,
  tabsOfDocuments,
} from "./layout";

const welcome = { id: "welcome", kind: "welcome", title: "Welcome" };
const repo = { id: "repo:/r", kind: "repository", title: "r", path: "/r" };

/** Two groups side by side; the second is active and shows the repository. */
function documents(panels: Record<string, unknown>): SerializedDockview {
  return {
    grid: {
      root: {
        type: "branch",
        data: [
          { type: "leaf", data: { id: "1", views: ["welcome"], activeView: "welcome" }, size: 1 },
          { type: "leaf", data: { id: "2", views: [repo.id], activeView: repo.id }, size: 1 },
        ],
      },
      width: 2,
      height: 1,
      orientation: "HORIZONTAL",
    },
    panels,
    activeGroup: "2",
  } as unknown as SerializedDockview;
}

const panel = (tab: { id: string }) => ({
  id: tab.id,
  contentComponent: "document",
  params: { tab },
});

describe("parseSavedLayout", () => {
  it("rejects missing values and other versions", () => {
    expect(parseSavedLayout(null)).toBeNull();
    expect(parseSavedLayout({ version: LAYOUT_VERSION + 1 })).toBeNull();
  });

  it("fills in defaults for damaged parts", () => {
    const parsed = parseSavedLayout({
      version: LAYOUT_VERSION,
      modules: 3,
      sidebar: { widthPx: -1 },
    });
    expect(parsed).toEqual({
      version: LAYOUT_VERSION,
      modules: null,
      documents: null,
      sidebar: { widthPx: DEFAULT_SIDEBAR_WIDTH_PX, collapsed: false },
      popouts: [],
      stacks: [],
      activityBar: { order: [], hidden: [], locked: false },
    });
  });

  it("keeps the popped-out modules", () => {
    const parsed = parseSavedLayout({ version: LAYOUT_VERSION, popouts: ["commit", 4] });
    expect(parsed?.popouts).toEqual(["commit"]);
  });

  it("keeps stacks and the activity bar, dropping what cannot be read", () => {
    const parsed = parseSavedLayout({
      version: LAYOUT_VERSION,
      stacks: [
        { modules: ["commit-details", "changed-files"], sizes: [40, 60] },
        { modules: ["changed-files", "files"] },
        { modules: ["branches"] },
        "junk",
      ],
      activityBar: { order: ["branches", 3], hidden: ["lfs"], locked: true },
    });
    expect(parsed?.stacks).toEqual([
      { modules: ["commit-details", "changed-files"], sizes: [40, 60] },
    ]);
    expect(parsed?.activityBar).toEqual({ order: ["branches"], hidden: ["lfs"], locked: true });
  });
});

describe("tabsOfDocuments", () => {
  it("returns the tabs and the active panel of the active group", () => {
    const saved = documents({ welcome: panel(welcome), [repo.id]: panel(repo) });
    expect(tabsOfDocuments(saved)).toEqual({ tabs: [welcome, repo], activeTabId: repo.id });
  });

  it("rejects the dock when a panel is not a valid tab", () => {
    const broken = { id: "x", params: { tab: { id: "x", kind: "nonsense", title: "x" } } };
    expect(tabsOfDocuments(documents({ welcome: panel(welcome), x: broken }))).toBeNull();
  });
});
