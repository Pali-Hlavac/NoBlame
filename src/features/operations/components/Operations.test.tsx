import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

import type { OperationDto } from "@/shared/ipc/bindings";

import { openMerge } from "../store/dialog";
import { operationTitle } from "../lib/words";
import { OperationBanner } from "./OperationBanner";
import { OperationDialogs } from "./OperationDialogs";

const ipc = vi.hoisted(() => ({
  mergeIntoCurrent: vi.fn(),
  stepOperation: vi.fn(),
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

function status(operation: OperationDto | null, conflicted: number) {
  return {
    summary: {
      staged: 0,
      unstaged: conflicted,
      untracked: 0,
      conflicted,
      changes: { added: 0, changed: 0, deleted: 0 },
    },
    staged: [],
    unstaged: [],
    operation,
  };
}

function renderWith(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

const MERGE: OperationDto = {
  kind: "merge",
  detail: "Merge branch 'topic'",
  step: null,
  steps: null,
};

describe("merging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.getStatus.mockReturnValue(ok(status(null, 0)));
  });

  it("merges with the chosen mode and says when it stopped on conflicts", async () => {
    const user = userEvent.setup();
    ipc.mergeIntoCurrent.mockReturnValue(ok({ outcome: "conflicts", summary: null }));
    renderWith(<OperationDialogs />);
    openMerge(1, { revision: "refs/heads/topic", label: "topic" });
    expect(await screen.findByRole("heading", { name: "Merge topic into main" })).toBeVisible();
    await user.click(screen.getByLabelText("Always create a merge commit"));
    await user.click(screen.getByRole("button", { name: "Merge" }));
    expect(ipc.mergeIntoCurrent).toHaveBeenCalledWith(1, {
      revision: "refs/heads/topic",
      mode: "noFastForward",
    });
    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        "The merge stopped: some files conflict",
        expect.anything(),
      );
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the merge in progress, waits for the conflicts, and aborts after asking", async () => {
    const user = userEvent.setup();
    ipc.getStatus.mockReturnValue(ok(status(MERGE, 2)));
    ipc.stepOperation.mockReturnValue(ok(""));
    renderWith(<OperationBanner repoId={1} />);
    expect(await screen.findByText("Merging: Merge branch 'topic'")).toBeVisible();
    expect(screen.getByText(/2 files conflict/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    // A merge has no commit to skip.
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Abort" }));
    const confirm = await screen.findByRole("dialog");
    expect(confirm).toHaveTextContent("before the merge");
    await user.click(within(confirm).getByRole("button", { name: "Abort" }));
    expect(ipc.stepOperation).toHaveBeenCalledWith(1, "abort");
  });

  it("names a rebase's branch and step", () => {
    expect(operationTitle({ kind: "rebase", detail: "feature", step: 3, steps: 7 })).toBe(
      "Rebasing feature (step 3 of 7)",
    );
  });
});
