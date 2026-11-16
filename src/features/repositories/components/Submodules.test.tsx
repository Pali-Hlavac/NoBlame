import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useTabsStore } from "@/features/workspace";
import type { SubmoduleDto } from "@/shared/ipc/bindings";
import { TooltipProvider } from "@/shared/ui/tooltip";

import { hasNewCommits, submoduleTitle, withNewCommits } from "../lib/submodules";
import { RepositoriesModule } from "./RepositoriesModule";
import { SubmoduleUpdateDialog } from "./SubmoduleUpdateDialog";

const ipc = vi.hoisted(() => ({
  listRecentRepositories: vi.fn(),
  getRepositoryGroups: vi.fn(),
  saveRepositoryGroups: vi.fn(),
  getSettings: vi.fn(),
  listSubmodules: vi.fn(),
  listJobs: vi.fn(),
  updateSubmodules: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const RECORDED = "b".repeat(40);

function submodule(path: string, overrides: Partial<SubmoduleDto> = {}): SubmoduleDto {
  return {
    name: path,
    path,
    workDir: `/r/app/${path}`,
    url: null,
    initialized: true,
    recorded: RECORDED,
    checkedOut: RECORDED,
    children: [],
    ...overrides,
  };
}

const LEAF = submodule("deps/leaf", { initialized: false, checkedOut: null });
const CORE = submodule("libs/core", { checkedOut: "a".repeat(40) });

function renderModule() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <RepositoriesModule />
        <SubmoduleUpdateDialog />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("submodule state", () => {
  it("tells new commits apart from a submodule on its recorded commit", () => {
    expect(hasNewCommits(CORE)).toBe(true);
    expect(hasNewCommits(LEAF)).toBe(false);
    expect(hasNewCommits(submodule("x"))).toBe(false);
    const nested = submodule("x", { children: [CORE] });
    expect(withNewCommits([nested, LEAF])).toEqual([CORE]);
    expect(submoduleTitle(LEAF)).toMatch(/not initialized/);
    expect(submoduleTitle(CORE)).toMatch(
      /checked out at aaaaaaaa, the repository records bbbbbbbb/,
    );
  });
});

describe("submodule actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTabsStore.setState({ tabs: [], activeTabId: null, activeRepositoryTabId: null });
    ipc.listRecentRepositories.mockResolvedValue({ status: "ok", data: [] });
    ipc.getRepositoryGroups.mockResolvedValue({
      status: "ok",
      data: {
        groups: [{ id: "g", name: "Work", collapsed: false, repositories: ["/r/app"] }],
        missing: [],
      },
    });
    ipc.getSettings.mockResolvedValue({ status: "ok", data: {} });
    ipc.listJobs.mockResolvedValue([]);
    ipc.listSubmodules.mockResolvedValue({ status: "ok", data: [LEAF, CORE] });
    ipc.updateSubmodules.mockResolvedValue({ status: "ok", data: 7 });
  });

  it("initializes a submodule from its context menu", async () => {
    const user = userEvent.setup();
    renderModule();
    fireEvent.contextMenu(await screen.findByText("deps/leaf"));
    await user.click(await screen.findByRole("menuitem", { name: "Initialize" }));
    expect(ipc.updateSubmodules).toHaveBeenCalledWith("/r/app", ["deps/leaf"]);
  });

  it("asks before moving a submodule with new commits", async () => {
    const user = userEvent.setup();
    renderModule();
    expect(await screen.findByText("new commits")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Actions for libs/core" }));
    await user.click(screen.getByRole("menuitem", { name: "Update to the recorded commit" }));
    expect(await screen.findByText("libs/core: aaaaaaaa → bbbbbbbb")).toBeInTheDocument();
    expect(ipc.updateSubmodules).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Update" }));
    expect(ipc.updateSubmodules).toHaveBeenCalledWith("/r/app", ["libs/core"]);
  });

  it("updates all submodules of a repository", async () => {
    const user = userEvent.setup();
    renderModule();
    await user.click(await screen.findByRole("button", { name: "Actions for app" }));
    await user.click(await screen.findByRole("menuitem", { name: "Update all submodules" }));
    await user.click(await screen.findByRole("button", { name: "Update" }));
    expect(ipc.updateSubmodules).toHaveBeenCalledWith("/r/app", []);
  });
});
