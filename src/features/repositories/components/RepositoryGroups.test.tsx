import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useTabsStore } from "@/features/workspace";
import type { RepositoryGroup, RepositoryGroupsDto } from "@/shared/ipc/bindings";
import { TooltipProvider } from "@/shared/ui/tooltip";

import { useGroupsUiStore } from "../store/groups";
import { RepositoriesModule } from "./RepositoriesModule";

const ipc = vi.hoisted(() => ({
  listRecentRepositories: vi.fn(),
  getRepositoryGroups: vi.fn(),
  saveRepositoryGroups: vi.fn(),
  getSettings: vi.fn(() => Promise.resolve({ status: "ok", data: {} })),
  listSubmodules: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const WORK: RepositoryGroup = {
  id: "g1",
  name: "Work",
  collapsed: false,
  repositories: ["/r/api"],
};

/** The last list sent to `save_repository_groups`. */
const lastSaved = (): RepositoryGroup[] =>
  (ipc.saveRepositoryGroups.mock.calls.at(-1)?.[0] ?? []) as RepositoryGroup[];

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

function renderModule(groups: RepositoryGroup[]) {
  ipc.getRepositoryGroups.mockResolvedValue({ status: "ok", data: { groups, missing: [] } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <RepositoriesModule />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("repository groups", () => {
  beforeEach(() => {
    useTabsStore.setState({ tabs: [], activeTabId: null, activeRepositoryTabId: null });
    useGroupsUiStore.setState({ editingId: null });
    ipc.listRecentRepositories.mockResolvedValue({
      status: "ok",
      data: [{ path: "/r/web", name: "web", lastOpened: 0, exists: true }],
    });
    ipc.listSubmodules.mockResolvedValue({ status: "ok", data: [] });
    ipc.saveRepositoryGroups.mockImplementation((groups: RepositoryGroup[]) =>
      Promise.resolve({
        status: "ok",
        data: { groups, missing: [] } satisfies RepositoryGroupsDto,
      }),
    );
  });

  it("creates a group and names it in place", async () => {
    const user = userEvent.setup();
    renderModule([]);
    await screen.findByText(/No groups yet/);
    await user.click(screen.getByRole("button", { name: "New group" }));
    // Focused with the name selected, so typing replaces it.
    expect(screen.getByRole("textbox", { name: "Group name" })).toHaveFocus();
    await user.keyboard("Clients{Enter}");
    await waitFor(() => {
      expect(lastSaved()).toMatchObject([{ name: "Clients", repositories: [] }]);
    });
    expect(screen.getByRole("button", { name: "Clients" })).toBeVisible();
  });

  it("adds a recent repository dropped on a group and folds the group", async () => {
    const user = userEvent.setup();
    renderModule([WORK]);
    const recent = await screen.findByRole("button", { name: "web" });
    const transfer = dataTransfer();
    fireEvent.dragStart(recent, { dataTransfer: transfer });
    const header = screen.getByRole("button", { name: "Work" });
    fireEvent.dragEnter(header, { dataTransfer: transfer });
    fireEvent.drop(header, { dataTransfer: transfer });
    await waitFor(() => {
      expect(lastSaved()[0]?.repositories).toEqual(["/r/api", "/r/web"]);
    });

    await user.click(screen.getByRole("button", { name: "Collapse Work" }));
    await waitFor(() => {
      expect(lastSaved()[0]?.collapsed).toBe(true);
    });
    expect(screen.queryByRole("button", { name: "api" })).toBeNull();
  });

  it("nests a grouped repository's submodules below it", async () => {
    const user = userEvent.setup();
    ipc.listSubmodules.mockImplementation((path: string) =>
      Promise.resolve({
        status: "ok",
        data:
          path === "/r/api"
            ? [
                {
                  name: "core",
                  path: "core",
                  workDir: "/r/api/core",
                  url: null,
                  initialized: true,
                  children: [],
                },
              ]
            : [],
      }),
    );
    renderModule([WORK]);
    expect(await screen.findByRole("button", { name: "core" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Collapse api" }));
    expect(screen.queryByRole("button", { name: "core" })).toBeNull();
  });

  it("asks before deleting a group that holds repositories", async () => {
    const user = userEvent.setup();
    renderModule([WORK]);
    await user.click(await screen.findByRole("button", { name: "Actions for the group Work" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete group…" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/The 1 repositories in it stay where they are/)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Delete group" }));
    await waitFor(() => {
      expect(lastSaved()).toEqual([]);
    });
  });

  it("lists pulling and pushing a whole group as coming in M5", async () => {
    const user = userEvent.setup();
    renderModule([WORK]);
    await user.click(await screen.findByRole("button", { name: "Actions for the group Work" }));
    expect(screen.getByRole("menuitem", { name: /Pull all/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: /Push all.*M5/ })).toBeVisible();
  });

  it("removes a repository from its group with the … button", async () => {
    const user = userEvent.setup();
    renderModule([WORK]);
    await user.click(await screen.findByRole("button", { name: "Actions for api" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove from group" }));
    await waitFor(() => {
      expect(lastSaved()[0]?.repositories).toEqual([]);
    });
  });
});
