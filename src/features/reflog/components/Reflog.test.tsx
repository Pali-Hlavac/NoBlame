import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { RefActionsContext, type RefActions } from "@/features/graph";
import { useSelectionStore } from "@/features/selection";
import type { ReflogEntryDto } from "@/shared/ipc/bindings";

import { describe as describeEntry, entryName, isDeletion } from "../lib/reflog";
import { ReflogModule } from "./ReflogModule";

const ipc = vi.hoisted(() => ({ getReflog: vi.fn(), goToCommit: vi.fn() }));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/repositories", () => ({
  useActiveRepository: () => ({ summary: { id: 1, head: { kind: "branch", name: "main" } } }),
  WithActiveRepository: ({
    children,
  }: {
    children: (summary: { id: number }, tab: { path: string }) => ReactNode;
  }) => children({ id: 1 }, { path: "/repo" }),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok" as const, data });
}

function entry(index: number, id: string, message: string): ReflogEntryDto {
  return { index, newId: id.repeat(40), oldId: "0".repeat(40), committer: "Ada", time: 0, message };
}

const ENTRIES = [
  entry(0, "a", "reset: moving to HEAD~1"),
  entry(1, "b", "commit: Lost work"),
  entry(2, "c", "checkout: moving from main to topic"),
];

function renderModule(actions?: RefActions) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RefActionsContext.Provider value={() => actions}>
        <ReflogModule />
      </RefActionsContext.Provider>
    </QueryClientProvider>,
  );
}

describe("reflog entries", () => {
  it("splits what git did from the rest", () => {
    expect(describeEntry("checkout: moving from main to topic")).toEqual({
      action: "checkout",
      detail: "moving from main to topic",
    });
    expect(describeEntry("rebase (finish): returning to refs/heads/topic").action).toBe(
      "rebase (finish)",
    );
    expect(entryName("refs/heads/topic", ENTRIES[1] ?? entry(0, "x", ""))).toBe("topic@{1}");
    expect(isDeletion(entry(0, "0", "branch: deleted"))).toBe(true);
  });
});

describe("the Reflog module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.getReflog.mockReturnValue(
      ok({ references: ["HEAD", "refs/heads/main"], entries: ENTRIES, truncated: false }),
    );
  });

  it("selects an entry's commit, or says it is on no branch", async () => {
    const user = userEvent.setup();
    ipc.goToCommit.mockReturnValueOnce(ok({ id: "a".repeat(40), row: 3, status: "shown" }));
    ipc.goToCommit.mockReturnValueOnce(ok({ id: "b".repeat(40), row: null, status: "shown" }));
    renderModule();
    await user.click(await screen.findByText("moving to HEAD~1"));
    expect(ipc.getReflog).toHaveBeenCalledWith(1, "HEAD");
    await vi.waitFor(() => {
      expect(useSelectionStore.getState().selections["/repo"]).toEqual({ kind: "commit", row: 3 });
    });
    await user.click(screen.getByText("Lost work"));
    await vi.waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/only the reflog/));
    });
  });

  it("restores a state through the reset dialog", async () => {
    const user = userEvent.setup();
    ipc.goToCommit.mockReturnValue(ok({ id: "b".repeat(40), row: 1, status: "shown" }));
    const actions = { reset: vi.fn(), createBranch: vi.fn(), checkoutCommit: vi.fn() };
    renderModule(actions as unknown as RefActions);
    const row = await screen.findByText("Lost work");
    await user.click(row);
    fireEvent.contextMenu(row);
    await user.click(await screen.findByRole("menuitem", { name: "Restore this state…" }));
    expect(actions.reset).toHaveBeenCalledWith(
      { revision: "b".repeat(40), label: "bbbbbbbb (HEAD@{1})" },
      { restore: true },
    );
  });
});
