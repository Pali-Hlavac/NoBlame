import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

import type { OperationDto } from "@/shared/ipc/bindings";

import { sideNames } from "../lib/conflicts";
import { openConflicts } from "../store/dialog";
import { OperationDialogs } from "./OperationDialogs";

const ipc = vi.hoisted(() => ({
  getConflicts: vi.fn(),
  takeConflictSide: vi.fn(),
  stageFiles: vi.fn(),
  openMergeTool: vi.fn(),
  getStatus: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/repositories", () => ({
  useActiveRepository: () => ({ summary: { id: 1, head: { kind: "branch", name: "main" } } }),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }),
}));

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok" as const, data });
}

const MERGE: OperationDto = {
  kind: "merge",
  detail: "Merge branch 'topic'",
  step: null,
  steps: null,
};

const STATUS = {
  summary: {
    staged: 0,
    unstaged: 2,
    untracked: 0,
    conflicted: 2,
    changes: { added: 0, changed: 2, deleted: 0 },
  },
  staged: [],
  unstaged: [],
  operation: MERGE,
};

function renderDialogs() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <OperationDialogs />
    </QueryClientProvider>,
  );
}

describe("resolving conflicts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.getStatus.mockReturnValue(ok(STATUS));
    ipc.getConflicts.mockReturnValue(
      ok([
        { path: "src/both.txt", kind: "bothModified" },
        { path: "gone.txt", kind: "deletedByUs" },
      ]),
    );
    ipc.takeConflictSide.mockReturnValue(ok(null));
    ipc.stageFiles.mockReturnValue(ok(null));
  });

  it("lists the files, names the sides, and takes one per file", async () => {
    const user = userEvent.setup();
    renderDialogs();
    openConflicts(1);
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("src/both.txt")).toBeVisible();
    expect(dialog).toHaveTextContent("Ours: main. Theirs: topic.");
    expect(within(dialog).getByText("deleted by ours, changed by theirs")).toBeVisible();
    // Taking ours for a file ours deleted deletes it; no merge tool without both versions.
    expect(within(dialog).getByRole("button", { name: "Use ours for gone.txt" })).toHaveTextContent(
      "Use ours (delete)",
    );
    expect(within(dialog).getAllByRole("button", { name: "Merge tool" })).toHaveLength(1);

    await user.click(within(dialog).getByRole("button", { name: "Use theirs for src/both.txt" }));
    expect(ipc.takeConflictSide).toHaveBeenCalledWith(1, ["src/both.txt"], "theirs");
    await user.click(within(dialog).getByRole("button", { name: "Mark gone.txt resolved" }));
    expect(ipc.stageFiles).toHaveBeenCalledWith(1, ["gone.txt"]);
    await user.click(within(dialog).getByRole("button", { name: "Use ours for all" }));
    expect(ipc.takeConflictSide).toHaveBeenCalledWith(1, ["src/both.txt", "gone.txt"], "ours");
  });

  it("opens a file in the merge tool and says so", async () => {
    const user = userEvent.setup();
    ipc.openMergeTool.mockReturnValue(ok("opened"));
    renderDialogs();
    openConflicts(1);
    await user.click(await screen.findByRole("button", { name: "Merge tool" }));
    expect(ipc.openMergeTool).toHaveBeenCalledWith(1, "src/both.txt");
    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith("Opened src/both.txt in the merge tool", {
        description: expect.stringMatching(/stages the file/) as unknown,
      });
    });
  });

  it("swaps the sides' roles during a rebase", () => {
    const rebase: OperationDto = { kind: "rebase", detail: "topic", step: 1, steps: 2 };
    expect(sideNames(rebase, "main")).toEqual({
      ours: "the branch you rebase onto",
      theirs: "your commit being replayed",
    });
  });
});
