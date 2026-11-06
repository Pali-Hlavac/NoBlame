import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArrowDownToLineIcon, ArrowUpFromLineIcon } from "lucide-react";

import { useTabsStore } from "@/features/workspace";
import type { JobDto, RepositoryButton, RepositoryGroup } from "@/shared/ipc/bindings";
import { TooltipProvider } from "@/shared/ui/tooltip";

import {
  GroupActionsContext,
  RepositoryActionsContext,
  type GroupAction,
  type RepositoryAction,
} from "../lib/actions";
import { RepositoriesModule } from "./RepositoriesModule";

const ipc = vi.hoisted(() => ({
  listRecentRepositories: vi.fn(),
  getRepositoryGroups: vi.fn(),
  saveRepositoryGroups: vi.fn(),
  getSettings: vi.fn(),
  listSubmodules: vi.fn(),
  listJobs: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const WORK: RepositoryGroup = {
  id: "g1",
  name: "Work",
  collapsed: false,
  repositories: ["/r/api"],
};

const pull = vi.fn();
const pullAll = vi.fn();
const pushAll = vi.fn();

const ACTIONS: RepositoryAction[] = [
  { id: "pull", label: "Pull", icon: ArrowDownToLineIcon, button: "pull", job: "pull", run: pull },
  { id: "push", label: "Push", icon: ArrowUpFromLineIcon, button: "push", job: "push", run: pull },
];
const GROUP_ACTIONS: GroupAction[] = [
  { id: "pull-all", label: "Pull all", icon: ArrowDownToLineIcon, button: "pullAll", run: pullAll },
  { id: "push-all", label: "Push all", icon: ArrowUpFromLineIcon, button: "pushAll", run: pushAll },
];

function runningPull(path: string): JobDto {
  return {
    id: 1,
    kind: "pull",
    title: "Pull main",
    repoPath: path,
    command: "git pull",
    state: "running",
    progress: null,
    message: null,
    logLines: 0,
    startedAt: 0,
    finishedAt: null,
  };
}

function renderModule(buttons: RepositoryButton[], jobs: JobDto[] = []) {
  ipc.getSettings.mockResolvedValue({ status: "ok", data: { repositories: { buttons } } });
  ipc.listJobs.mockResolvedValue(jobs);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <RepositoryActionsContext.Provider value={ACTIONS}>
          <GroupActionsContext.Provider value={GROUP_ACTIONS}>
            <RepositoriesModule />
          </GroupActionsContext.Provider>
        </RepositoryActionsContext.Provider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("quick buttons and group actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTabsStore.setState({ tabs: [], activeTabId: null, activeRepositoryTabId: null });
    ipc.listRecentRepositories.mockResolvedValue({ status: "ok", data: [] });
    ipc.getRepositoryGroups.mockResolvedValue({
      status: "ok",
      data: { groups: [WORK], missing: [] },
    });
    ipc.listSubmodules.mockResolvedValue({ status: "ok", data: [] });
  });

  it("shows only the buttons chosen in Settings, and runs them", async () => {
    const user = userEvent.setup();
    renderModule(["pull", "pushAll"]);
    await user.click(await screen.findByRole("button", { name: "Pull api" }));
    expect(pull).toHaveBeenCalledWith({
      path: "/r/api",
      tabId: "repository:/r/api",
      title: "api",
      open: false,
    });
    expect(screen.queryByRole("button", { name: "Push api" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pull all in Work" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Push all in Work" }));
    expect(pushAll).toHaveBeenCalledWith({ name: "Work", paths: ["/r/api"] });
  });

  it("offers Pull all and Push all in the group's menu", async () => {
    const user = userEvent.setup();
    renderModule([]);
    await user.click(await screen.findByRole("button", { name: "Actions for the group Work" }));
    await user.click(screen.getByRole("menuitem", { name: "Pull all" }));
    expect(pullAll).toHaveBeenCalledWith({ name: "Work", paths: ["/r/api"] });
  });

  it("spins and waits while its job runs", async () => {
    renderModule(["pull"], [runningPull("/r/api")]);
    expect(await screen.findByRole("button", { name: "Pull api (running)" })).toBeDisabled();
  });
});
