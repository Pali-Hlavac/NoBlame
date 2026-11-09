import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

import { openRebase } from "../store/dialog";
import { OperationDialogs } from "./OperationDialogs";

const ipc = vi.hoisted(() => ({
  rebaseCurrent: vi.fn(),
  getRebasePreview: vi.fn(),
  getStatus: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/repositories", () => ({
  useActiveRepository: () => ({ summary: { id: 1, head: { kind: "branch", name: "topic" } } }),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok" as const, data });
}

function status(unstaged: number) {
  return {
    summary: {
      staged: 0,
      unstaged,
      untracked: 0,
      conflicted: 0,
      changes: { added: 0, changed: unstaged, deleted: 0 },
    },
    staged: [],
    unstaged: [],
    operation: null,
  };
}

const ONTO = { revision: "refs/remotes/origin/main", label: "origin/main" };

function renderDialogs() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <OperationDialogs />
    </QueryClientProvider>,
  );
}

describe("rebasing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("names the replayed commits, warns about pushed ones, and stashes changes meanwhile", async () => {
    const user = userEvent.setup();
    ipc.getStatus.mockReturnValue(ok(status(1)));
    ipc.getRebasePreview.mockReturnValue(
      ok({
        replayed: { count: 2, newest: [{ id: "fedcba9876543210", summary: "Add the parser" }] },
        published: 1,
      }),
    );
    ipc.rebaseCurrent.mockReturnValue(ok("rebased"));
    renderDialogs();
    openRebase(1, ONTO);
    expect(
      await screen.findByRole("heading", { name: "Rebase topic onto origin/main" }),
    ).toBeVisible();
    expect(await screen.findByText(/2 commits of topic are replayed/)).toBeVisible();
    expect(screen.getByText(/Add the parser/)).toBeVisible();
    expect(screen.getByText(/1 of them was pushed already/)).toBeVisible();
    expect(ipc.getRebasePreview).toHaveBeenCalledWith(1, ONTO.revision);
    // There are uncommitted changes: stashing them meanwhile is chosen.
    await waitFor(() => {
      expect(screen.getByLabelText("Stash my uncommitted changes meanwhile")).toBeChecked();
    });
    await user.click(screen.getByLabelText("Keep merge commits"));
    await user.click(screen.getByRole("button", { name: "Rebase" }));
    expect(ipc.rebaseCurrent).toHaveBeenCalledWith(1, {
      onto: ONTO.revision,
      autostash: true,
      rebaseMerges: true,
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Rebased topic onto origin/main", {
        description: expect.stringMatching(/push it with force/) as unknown,
      });
    });
  });

  it("says when the rebase stopped on conflicts", async () => {
    const user = userEvent.setup();
    ipc.getStatus.mockReturnValue(ok(status(0)));
    ipc.getRebasePreview.mockReturnValue(ok({ replayed: { count: 0, newest: [] }, published: 0 }));
    ipc.rebaseCurrent.mockReturnValue(ok("conflicts"));
    renderDialogs();
    openRebase(1, ONTO);
    expect(await screen.findByText(/has no commits of its own/)).toBeVisible();
    expect(screen.getByLabelText("Stash my uncommitted changes meanwhile")).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "Rebase" }));
    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        "The rebase stopped: some files conflict",
        expect.anything(),
      );
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
