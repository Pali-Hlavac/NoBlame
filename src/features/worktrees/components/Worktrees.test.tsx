import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { WorktreeDto } from "@/shared/ipc/bindings";
import { TooltipProvider } from "@/shared/ui/tooltip";

import { changesText, checkedOut, folderProblem, suggestedFolder } from "../lib/worktrees";
import { useWorktreeDialog } from "../store/dialog";
import { Worktrees } from "./WorktreesModule";

const ipc = vi.hoisted(() => ({
  listWorktrees: vi.fn(),
  addWorktree: vi.fn(),
  removeWorktree: vi.fn(),
  lockWorktree: vi.fn(),
  unlockWorktree: vi.fn(),
  pruneWorktrees: vi.fn(),
  getChangeCounts: vi.fn(),
  listRefs: vi.fn(),
}));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
const opened = vi.hoisted(() => vi.fn());
vi.mock("@/features/repositories", () => ({
  WithActiveRepository: () => null,
  openRepositories: opened,
  pickFolder: vi.fn(),
  useActiveRepository: () => ({ summary: { id: 1, head: { kind: "branch", name: "main" } } }),
}));

function worktree(path: string, overrides: Partial<WorktreeDto> = {}): WorktreeDto {
  return {
    path,
    head: "a".repeat(40),
    branch: null,
    bare: false,
    main: false,
    current: false,
    locked: null,
    prunable: null,
    ...overrides,
  };
}

const MAIN = worktree("/code/app", { branch: "main", main: true, current: true });
const TOPIC = worktree("/code/app-topic", { branch: "topic" });
const GONE = worktree("/code/app-old", { prunable: "gitdir file points to non-existent location" });

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok" as const, data });
}

function renderModule() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <Worktrees repoId={1} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("worktree words", () => {
  it("names what is checked out and where a new one goes", () => {
    expect(checkedOut(TOPIC)).toBe("topic");
    expect(checkedOut(worktree("/x"))).toBe("detached at aaaaaaaa");
    expect(suggestedFolder("C:\\code\\app", "feature/x y")).toBe("C:\\code\\app-feature-x-y");
    expect(suggestedFolder("/code/app", "")).toBe("/code/app-worktree");
    expect(folderProblem("relative/path")).toMatch(/full path/);
    expect(folderProblem("D:\\wt")).toBeNull();
    expect(changesText({ added: 2, changed: 1, deleted: 0 })).toBe("2 new and 1 changed files");
    expect(changesText({ added: 0, changed: 0, deleted: 0 })).toBeNull();
  });
});

describe("the Worktrees module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorktreeDialog.setState({ dialog: null });
    ipc.listWorktrees.mockReturnValue(ok([MAIN, TOPIC, GONE]));
    ipc.listRefs.mockReturnValue(ok([]));
    ipc.addWorktree.mockReturnValue(ok("Preparing worktree"));
    ipc.removeWorktree.mockReturnValue(ok(""));
    ipc.pruneWorktrees.mockReturnValue(ok(""));
  });

  it("lists the worktrees and opens one", async () => {
    const user = userEvent.setup();
    renderModule();
    const list = await screen.findByRole("list", { name: "Worktrees" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("this tab")).toBeInTheDocument();
    expect(screen.getByText("folder gone")).toBeInTheDocument();
    await user.click(screen.getByText("app-topic"));
    expect(opened).toHaveBeenCalledWith(["/code/app-topic"]);
    await user.click(screen.getByText("app-old"));
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it("adds a worktree with a new branch next to the main one", async () => {
    const user = userEvent.setup();
    renderModule();
    await user.click(await screen.findByRole("button", { name: "Add a worktree" }));
    await user.type(screen.getByLabelText("Branch name"), "fix");
    expect(screen.getByLabelText("Folder")).toHaveValue("/code/app-fix");
    await user.click(screen.getByRole("button", { name: "Add worktree" }));
    expect(ipc.addWorktree).toHaveBeenCalledWith(1, {
      folder: "/code/app-fix",
      checkout: { kind: "newBranch", name: "fix", start: "main" },
    });
    await vi.waitFor(() => {
      expect(opened).toHaveBeenCalledWith(["/code/app-fix"]);
    });
  });

  it("names uncommitted files before removing a worktree, then forces it", async () => {
    const user = userEvent.setup();
    ipc.getChangeCounts.mockReturnValue(ok({ added: 1, changed: 0, deleted: 0 }));
    renderModule();
    fireEvent.contextMenu(await screen.findByText("app-topic"));
    await user.click(await screen.findByRole("menuitem", { name: "Remove…" }));
    expect(await screen.findByText(/has 1 new file not committed/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove with its changes" }));
    expect(ipc.removeWorktree).toHaveBeenCalledWith(1, "/code/app-topic", true);
  });

  it("prunes the worktrees whose folders are gone", async () => {
    const user = userEvent.setup();
    renderModule();
    await user.click(
      await screen.findByRole("button", { name: "Prune worktrees whose folders are gone" }),
    );
    expect(
      within(screen.getByRole("dialog")).getByText("/code/app-old (detached at aaaaaaaa)"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Prune" }));
    expect(ipc.pruneWorktrees).toHaveBeenCalledWith(1);
  });
});
