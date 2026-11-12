import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { setStatusScope } from "@/features/working-tree";
import type { WorkingTreeStatusDto } from "@/shared/ipc/bindings";

import { CommitPanel } from "./CommitPanel";

const ipc = vi.hoisted(() => ({
  getStatus: vi.fn(),
  stageFiles: vi.fn(),
  stageAllFiles: vi.fn(),
  getCommitDefaults: vi.fn(),
  getRecentMessages: vi.fn(),
}));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

/** `src/a.ts` changed; nothing staged in `src`, two files staged elsewhere. */
const STATUS: WorkingTreeStatusDto = {
  summary: {
    staged: 0,
    unstaged: 1,
    untracked: 0,
    conflicted: 0,
    changes: { added: 0, changed: 1, deleted: 0 },
  },
  staged: [],
  unstaged: [
    {
      path: "src/a.ts",
      previousPath: null,
      status: "modified",
      oldId: null,
      newId: null,
      worktree: true,
      submodule: false,
      submoduleChanges: null,
    },
  ],
  operation: null,
  stagedOutside: 2,
};

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CommitPanel repoId={1} repoPath="/repo/src" showDiff={false} />
    </QueryClientProvider>,
  );
}

describe("a commit window limited to a folder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStatusScope("src");
    ipc.getStatus.mockResolvedValue({ status: "ok", data: STATUS });
    ipc.stageFiles.mockResolvedValue({ status: "ok", data: null });
    ipc.getCommitDefaults.mockResolvedValue({
      status: "ok",
      data: { author: null, template: null, commentChar: "#" },
    });
    ipc.getRecentMessages.mockResolvedValue({ status: "ok", data: [] });
  });
  afterEach(() => {
    setStatusScope(null);
  });

  it("reads the status of the folder and stages all of it, not everything", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Stage all" }));
    await waitFor(() => {
      expect(ipc.stageFiles).toHaveBeenCalledWith(1, ["src"]);
    });
    expect(ipc.getStatus).toHaveBeenCalledWith(1, "src");
    expect(ipc.stageAllFiles).not.toHaveBeenCalled();
  });

  it("says that files staged elsewhere are committed too", async () => {
    renderPanel();
    expect(await screen.findByText(/Also commits 2 files staged outside/)).toHaveTextContent(
      "Also commits 2 files staged outside src.",
    );
    expect(screen.queryByText("Stage the changes to commit first.")).not.toBeInTheDocument();
  });
});
