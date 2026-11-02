import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useTabsStore } from "@/features/workspace";
import type { Settings } from "@/shared/ipc/bindings";
import { TooltipProvider } from "@/shared/ui/tooltip";

import { RepositoriesModule } from "./RepositoriesModule";

const ipc = vi.hoisted(() => ({
  listRecentRepositories: vi.fn(),
  getRepositoryGroups: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

/** The repositories settings last saved. */
const lastSaved = () =>
  (ipc.updateSettings.mock.calls.at(-1)?.[0] as Settings | undefined)?.repositories;

/** A stand-in for the browser's DataTransfer (jsdom has none). */
function dataTransfer() {
  const data = new Map<string, string>();
  return {
    get types() {
      return [...data.keys()];
    },
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
    effectAllowed: "all",
    dropEffect: "none",
  };
}

/** Section titles from top to bottom. */
const titles = () =>
  screen.getAllByRole("region").map((section) => section.getAttribute("aria-label"));

function renderModule() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <RepositoriesModule />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("Repositories module sections", () => {
  beforeEach(() => {
    useTabsStore.setState({ tabs: [], activeTabId: null, activeRepositoryTabId: null });
    ipc.listRecentRepositories.mockResolvedValue({
      status: "ok",
      data: [{ path: "/r/web", name: "web", lastOpened: 0, exists: true }],
    });
    ipc.getRepositoryGroups.mockResolvedValue({ status: "ok", data: { groups: [], missing: [] } });
    ipc.getSettings.mockResolvedValue({
      status: "ok",
      data: { repositories: { sections: ["recent", "open"], collapsedSections: [] } },
    });
    ipc.updateSettings.mockImplementation((settings: Settings) =>
      Promise.resolve({ status: "ok", data: settings }),
    );
  });

  it("shows the sections in the saved order, adding any missing", async () => {
    renderModule();
    await screen.findByRole("button", { name: "web" });
    expect(titles()).toEqual(["Recent", "Open", "Groups"]);
  });

  it("folds a section by its title and saves that", async () => {
    const user = userEvent.setup();
    renderModule();
    await user.click(await screen.findByRole("button", { name: "Recent" }));
    expect(screen.queryByRole("button", { name: "web" })).toBeNull();
    await waitFor(() => {
      expect(lastSaved()?.collapsedSections).toEqual(["recent"]);
    });
  });

  it("moves a section by dragging its title, or with Alt+Down", async () => {
    renderModule();
    await screen.findByRole("button", { name: "web" });
    const transfer = dataTransfer();
    fireEvent.dragStart(screen.getByRole("button", { name: "Groups" }), {
      dataTransfer: transfer,
    });
    const recent = screen.getByRole("region", { name: "Recent" });
    fireEvent.dragEnter(recent, { dataTransfer: transfer });
    // jsdom has no layout, so the drop counts as the upper half: before Recent.
    fireEvent.drop(recent, { dataTransfer: transfer, clientY: -1 });
    await waitFor(() => {
      expect(titles()).toEqual(["Groups", "Recent", "Open"]);
    });

    fireEvent.keyDown(screen.getByRole("button", { name: "Groups" }), {
      key: "ArrowDown",
      altKey: true,
    });
    await waitFor(() => {
      expect(lastSaved()?.sections).toEqual(["recent", "groups", "open"]);
    });
  });
});
