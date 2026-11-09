import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

import { openPick, openReset } from "../store/dialog";
import { OperationDialogs } from "./OperationDialogs";

const ipc = vi.hoisted(() => ({
  pickCommit: vi.fn(),
  resetCurrent: vi.fn(),
  getMissingCommits: vi.fn(),
  getStatus: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/repositories", () => ({
  useActiveRepository: () => ({ summary: { id: 1, head: { kind: "branch", name: "main" } } }),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok" as const, data });
}

/** Two changed tracked files, one untracked. */
const STATUS = {
  summary: {
    staged: 1,
    unstaged: 1,
    untracked: 1,
    conflicted: 0,
    changes: { added: 1, changed: 2, deleted: 0 },
  },
  staged: [],
  unstaged: [],
  operation: null,
};

const COMMIT = { revision: "0123456789abcdef", label: "01234567 Fix the parser" };

function renderDialogs() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <OperationDialogs />
    </QueryClientProvider>,
  );
}

describe("cherry-pick, revert and reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.getStatus.mockReturnValue(ok(STATUS));
  });

  it("cherry-picks with the chosen options and says what happened", async () => {
    const user = userEvent.setup();
    ipc.pickCommit.mockReturnValue(ok({ outcome: "committed", summary: "1 file changed" }));
    renderDialogs();
    openPick(1, "cherryPick", { ...COMMIT, parentCount: 1 });
    expect(
      await screen.findByRole("heading", { name: "Cherry-pick 01234567 Fix the parser" }),
    ).toBeVisible();
    // Not a merge: no parent to choose.
    expect(screen.queryByText(/This is a merge/)).toBeNull();
    await user.click(screen.getByLabelText("Note where it came from"));
    await user.click(screen.getByRole("button", { name: "Cherry-pick" }));
    expect(ipc.pickCommit).toHaveBeenCalledWith(1, {
      kind: "cherryPick",
      commit: COMMIT.revision,
      mainline: null,
      noCommit: false,
      recordOrigin: true,
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Cherry-picked 01234567 Fix the parser onto main",
        {
          description: "1 file changed",
        },
      );
    });
  });

  it("reverts a merge against the chosen parent", async () => {
    const user = userEvent.setup();
    ipc.pickCommit.mockReturnValue(ok({ outcome: "conflicts", summary: null }));
    renderDialogs();
    openPick(1, "revert", { ...COMMIT, parentCount: 2 });
    await user.click(await screen.findByLabelText(/Parent 2/));
    // Only cherry-picks note their origin.
    expect(screen.queryByLabelText("Note where it came from")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Revert" }));
    expect(ipc.pickCommit).toHaveBeenCalledWith(1, expect.objectContaining({ mainline: 2 }));
    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        "The revert stopped: some files conflict",
        expect.anything(),
      );
    });
  });

  it("names what a hard reset loses before it runs", async () => {
    const user = userEvent.setup();
    ipc.getMissingCommits.mockReturnValue(
      ok({ count: 4, newest: [{ id: "fedcba9876543210", summary: "Newest work" }] }),
    );
    ipc.resetCurrent.mockReturnValue(ok("HEAD is now at 01234567"));
    renderDialogs();
    openReset(1, COMMIT);
    expect(await screen.findByText(/4 commits leave main/)).toBeVisible();
    expect(screen.getByText(/Newest work/)).toBeVisible();
    expect(ipc.getMissingCommits).toHaveBeenCalledWith(1, "HEAD", COMMIT.revision);
    // Mixed (git's default) loses nothing.
    expect(screen.getByLabelText("Mixed")).toBeChecked();
    expect(screen.queryByText(/lost for good/)).toBeNull();

    await user.click(screen.getByLabelText("Hard"));
    // The untracked file stays: two files lose their changes.
    expect(
      await screen.findByText("Uncommitted changes to 2 files are lost for good."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reset and discard changes" }));
    expect(ipc.resetCurrent).toHaveBeenCalledWith(1, { commit: COMMIT.revision, mode: "hard" });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Reset main to 01234567 Fix the parser");
    });
  });
});
