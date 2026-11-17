import { act, render } from "@testing-library/react";
import { StrictMode } from "react";

import { SETTINGS_TAB, useTabsStore, WELCOME_TAB } from "@/features/workspace";

import { docks } from "../lib/docks";
import { DocumentDock } from "./DocumentDock";

vi.mock("../api/layout", () => ({ saveLayout: vi.fn(() => Promise.resolve()) }));

describe("DocumentDock", () => {
  it("keeps following the tabs after React runs its effects again", () => {
    useTabsStore.getState().replaceTabs([WELCOME_TAB], WELCOME_TAB.id);
    // StrictMode runs every effect twice, as a hot reload does: the dock must stay connected.
    render(
      <StrictMode>
        <DocumentDock renderTab={(tab) => tab.title} saved={null} />
      </StrictMode>,
    );
    act(() => {
      useTabsStore.getState().openTab(SETTINGS_TAB);
    });
    const api = docks.documents;
    expect(api?.getPanel(SETTINGS_TAB.id)).toBeDefined();
    expect(api?.activePanel?.id).toBe(SETTINGS_TAB.id);
  });
});
