import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { useTabsStore } from "@/features/workspace";
import type { RepositoryGroup } from "@/shared/ipc/bindings";
import { TooltipProvider } from "@/shared/ui/tooltip";

import { sessionKeys } from "../api/session";
import { repositoryTab } from "../lib/path";
import { RepositoriesModule } from "./RepositoriesModule";

const ipc = vi.hoisted(() => ({
  listRecentRepositories: vi.fn(),
  getRepositoryGroups: vi.fn(),
  getSettings: vi.fn(),
  listSubmodules: vi.fn(),
  getChangeCounts: vi.fn(),
  getStatus: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const GROUP: RepositoryGroup = {
  id: "g1",
  name: "Work",
  collapsed: false,
  repositories: ["/r/api", "/r/open"],
};

const OPEN = repositoryTab("/r/open");

function renderModule(showChangeCounts: boolean) {
  ipc.getSettings.mockResolvedValue({
    status: "ok",
    data: { repositories: { showChangeCounts } },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // The open repository's tab has opened its session already.
  client.setQueryData(sessionKeys.byPath(OPEN.path), { id: 7 });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <RepositoriesModule />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("uncommitted file counts", () => {
  beforeEach(() => {
    useTabsStore.setState({ tabs: [OPEN], activeTabId: OPEN.id, activeRepositoryTabId: OPEN.id });
    ipc.listRecentRepositories.mockResolvedValue({
      status: "ok",
      data: [{ path: "/r/web", name: "web", lastOpened: 0, exists: true }],
    });
    ipc.getRepositoryGroups.mockResolvedValue({
      status: "ok",
      data: { groups: [GROUP], missing: [] },
    });
    ipc.listSubmodules.mockResolvedValue({ status: "ok", data: [] });
    ipc.getChangeCounts.mockImplementation((path: string) =>
      Promise.resolve({
        status: "ok",
        data:
          path === "/r/web"
            ? { added: 2, changed: 1, deleted: 0 }
            : { added: 0, changed: 0, deleted: 0 },
      }),
    );
    ipc.getStatus.mockResolvedValue({
      status: "ok",
      data: {
        summary: {
          staged: 1,
          unstaged: 3,
          untracked: 0,
          conflicted: 0,
          changes: { added: 0, changed: 3, deleted: 1 },
        },
        staged: [],
        unstaged: [],
      },
    });
  });

  it("counts closed repositories with git status and open ones from their session", async () => {
    renderModule(true);
    const recent = await screen.findByRole("button", {
      name: "web, 2 new and 1 changed files not committed",
    });
    expect(recent).toHaveTextContent("+2~1");
    // Open, and in the group too: both rows read the session's status.
    expect(
      await screen.findAllByRole("button", {
        name: "open, 3 changed and 1 deleted files not committed",
      }),
    ).toHaveLength(2);
    expect(ipc.getStatus).toHaveBeenCalledWith(7);
    expect(ipc.getChangeCounts).not.toHaveBeenCalledWith("/r/open");
    // A clean repository shows nothing.
    expect(await screen.findByRole("button", { name: "api" })).toHaveTextContent(/^api$/);
    expect(ipc.getChangeCounts).toHaveBeenCalledWith("/r/api");
  });

  it("counts a restored tab with git status until its session opens", async () => {
    const later = repositoryTab("/r/web");
    useTabsStore.setState({ tabs: [OPEN, later] });
    renderModule(true);
    expect(
      await screen.findAllByRole("button", {
        name: "web, 2 new and 1 changed files not committed",
      }),
    ).not.toHaveLength(0);
    expect(ipc.getChangeCounts).toHaveBeenCalledWith("/r/web");
  });

  it("runs nothing while the setting is off", async () => {
    renderModule(false);
    await screen.findByRole("button", { name: "web" });
    await screen.findAllByRole("button", { name: "open" });
    expect(ipc.getChangeCounts).not.toHaveBeenCalled();
    expect(ipc.getStatus).not.toHaveBeenCalled();
  });
});
