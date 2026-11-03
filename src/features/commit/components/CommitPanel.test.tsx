import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { useSelectionStore } from "@/features/selection";
import type { WorkingFileDto, WorkingTreeStatusDto } from "@/shared/ipc/bindings";

import { useDraftStore } from "../store/draft";
import { CommitPanel } from "./CommitPanel";

const ipc = vi.hoisted(() => ({
  getStatus: vi.fn(),
  stageFiles: vi.fn(),
  stageAllFiles: vi.fn(),
  unstageFiles: vi.fn(),
  unstageAllFiles: vi.fn(),
  createCommit: vi.fn(),
  getHeadMessage: vi.fn(),
}));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const ID = "1111111111111111111111111111111111111111";
const OK = { status: "ok", data: null };

function file(path: string, status: WorkingFileDto["status"]): WorkingFileDto {
  return {
    path,
    previousPath: null,
    status,
    oldId: ID,
    newId: null,
    worktree: true,
    submodule: false,
  };
}

const STATUS: WorkingTreeStatusDto = {
  summary: { staged: 1, unstaged: 1, untracked: 0, conflicted: 1 },
  staged: [
    { ...file("src/new.ts", "renamed"), previousPath: "src/old.ts", newId: ID, worktree: false },
  ],
  unstaged: [file("src/both.ts", "conflicted"), file("src/main.ts", "modified")],
};

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CommitPanel repoId={1} repoPath="/repo" showDiff={false} />
    </QueryClientProvider>,
  );
}

function messageBox(): HTMLTextAreaElement {
  return screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Commit message" });
}

describe("CommitPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSelectionStore.setState({ selections: {}, files: {} });
    useDraftStore.setState({ drafts: {} });
    ipc.getStatus.mockResolvedValue({ status: "ok", data: STATUS });
    for (const command of [
      ipc.stageFiles,
      ipc.stageAllFiles,
      ipc.unstageFiles,
      ipc.unstageAllFiles,
    ]) {
      command.mockResolvedValue(OK);
    }
  });

  it("stages a file with its button and unstages a rename by both names", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Stage src/main.ts" }));
    await waitFor(() => {
      expect(ipc.stageFiles).toHaveBeenCalledWith(1, ["src/main.ts"]);
    });
    fireEvent.click(screen.getByRole("button", { name: "Unstage src/new.ts" }));
    await waitFor(() => {
      expect(ipc.unstageFiles).toHaveBeenCalledWith(1, ["src/new.ts", "src/old.ts"]);
    });
  });

  it("stages the active file with Space and shows the next one", async () => {
    renderPanel();
    const changes = await screen.findByRole("listbox", { name: "Changes" });
    fireEvent.mouseDown(screen.getByRole("option", { name: "main.ts, modified, in src" }));
    expect(useSelectionStore.getState().selections["/repo"]).toEqual({ kind: "worktree" });
    fireEvent.keyDown(changes, { key: " " });
    await waitFor(() => {
      expect(ipc.stageFiles).toHaveBeenCalledWith(1, ["src/main.ts"]);
    });
    // main.ts was last in the list: the diff shows the one before it.
    expect(useSelectionStore.getState().files["/repo"]).toBe("src/both.ts");
  });

  it("asks before staging conflicted files, which marks them resolved", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Stage all" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Stage all, marking 1 conflicted file as resolved?",
    });
    expect(ipc.stageAllFiles).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Stage" }));
    await waitFor(() => {
      expect(ipc.stageAllFiles).toHaveBeenCalledWith(1);
    });
  });

  it("commits with Ctrl+Enter, shows git's output and clears the message", async () => {
    ipc.createCommit.mockResolvedValue({
      status: "ok",
      data: { output: "[main abc1234] Fix the parser\n 1 file changed" },
    });
    renderPanel();
    await screen.findByRole("listbox", { name: "Staged" });
    fireEvent.change(messageBox(), { target: { value: "Fix the parser" } });
    fireEvent.keyDown(messageBox(), { key: "Enter", ctrlKey: true });
    expect(await screen.findByText(/\[main abc1234\] Fix the parser/)).toBeVisible();
    expect(ipc.createCommit).toHaveBeenCalledWith(1, {
      message: "Fix the parser",
      amend: false,
      signOff: false,
    });
    expect(messageBox().value).toBe("");
  });

  it("shows what a failing hook printed and keeps the message", async () => {
    ipc.createCommit.mockResolvedValue({
      status: "error",
      error: { code: "GIT_FAILED", message: "lint: 3 problems", hint: null },
    });
    renderPanel();
    await screen.findByRole("listbox", { name: "Staged" });
    fireEvent.change(messageBox(), { target: { value: "Fix" } });
    fireEvent.click(screen.getByRole("button", { name: "Commit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("lint: 3 problems");
    expect(messageBox().value).toBe("Fix");
  });

  it("fills in the last message for Amend and takes it away again", async () => {
    ipc.getHeadMessage.mockResolvedValue({ status: "ok", data: "Old subject\n\nBody\n" });
    renderPanel();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Amend last commit" }));
    await waitFor(() => {
      expect(messageBox().value).toBe("Old subject\n\nBody");
    });
    expect(screen.getByRole("button", { name: "Amend" })).toBeEnabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Amend last commit" }));
    expect(messageBox().value).toBe("");
  });

  it("says why it cannot commit when nothing is staged", async () => {
    ipc.getStatus.mockResolvedValue({
      status: "ok",
      data: { ...STATUS, summary: { ...STATUS.summary, staged: 0 }, staged: [] },
    });
    renderPanel();
    expect(await screen.findByText("Stage the changes to commit first.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled();
  });
});
