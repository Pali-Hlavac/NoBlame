import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useTabsStore } from "@/features/workspace";
import type { ChangedFileDto, StashDto, WorkingFileDto } from "@/shared/ipc/bindings";

import { useShownStashStore } from "../store/shown";
import { Stashes } from "./StashesModule";
import { StashBody } from "./StashView";

const ipc = vi.hoisted(() => ({
  listStashes: vi.fn(),
  getStatus: vi.fn(),
  stashChanges: vi.fn(),
  applyStash: vi.fn(),
  dropStash: vi.fn(),
  getStashFiles: vi.fn(),
  applyStashFiles: vi.fn(),
}));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/diff", () => ({
  FileDiffView: ({ file }: { file: ChangedFileDto }) => <p>Diff of {file.path}</p>,
}));

const ID = "1111111111111111111111111111111111111111";
const STASH: StashDto = {
  index: 0,
  id: ID,
  message: "On main: half done",
  branch: "main",
  time: 0,
};

function changed(path: string): ChangedFileDto {
  return { path, previousPath: null, status: "modified", oldId: ID, newId: ID, submodule: false };
}

function working(path: string, status: WorkingFileDto["status"]): WorkingFileDto {
  return {
    path,
    previousPath: null,
    status,
    oldId: null,
    newId: null,
    worktree: true,
    submodule: false,
    submoduleChanges: null,
  };
}

function renderWith(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("Stashes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useShownStashStore.setState({ shown: {}, restoreIndex: false });
    useTabsStore.setState({ tabs: [], activeTabId: null, activeRepositoryTabId: null });
    ipc.listStashes.mockResolvedValue({ status: "ok", data: [STASH] });
    ipc.getStashFiles.mockResolvedValue({
      status: "ok",
      data: {
        base: ID,
        changed: [changed("a.txt"), changed("b.txt")],
        changedTotal: 2,
        untracked: [{ ...changed("new.txt"), status: "added", oldId: null }],
        untrackedTotal: 1,
      },
    });
  });

  it("stashes only the files left chosen, with a message", async () => {
    ipc.getStatus.mockResolvedValue({
      status: "ok",
      data: {
        summary: { staged: 0, unstaged: 2, untracked: 0, conflicted: 0 },
        staged: [],
        unstaged: [working("a.txt", "modified"), working("b.txt", "modified")],
      },
    });
    ipc.stashChanges.mockResolvedValue({ status: "ok", data: "Saved working directory" });
    renderWith(<Stashes repoId={1} repoPath="/repo" />);
    fireEvent.click(await screen.findByRole("button", { name: "Stash changes…" }));
    const dialog = await screen.findByRole("dialog", { name: "Stash changes" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Stash message" }), {
      target: { value: "half done" },
    });
    fireEvent.click(await within(dialog).findByRole("checkbox", { name: "Choose b.txt" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Stash" }));
    await waitFor(() => {
      expect(ipc.stashChanges).toHaveBeenCalledWith(1, {
        message: "half done",
        keepIndex: false,
        includeUntracked: false,
        paths: ["a.txt"],
      });
    });
  });

  it("shows a stash in the Stash tab and applies its chosen files", async () => {
    ipc.applyStashFiles.mockResolvedValue({ status: "ok", data: { output: "", conflicts: false } });
    renderWith(<Stashes repoId={1} repoPath="/repo" />);
    fireEvent.click(await screen.findByRole("button", { name: /half done/ }));
    expect(useTabsStore.getState().activeTabId).toBe("stash");
    expect(useShownStashStore.getState().shown["/repo"]?.id).toBe(ID);

    renderWith(<StashBody repoId={1} repoPath="/repo" />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Choose b.txt" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Choose new.txt" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply 2 chosen" }));
    await waitFor(() => {
      expect(ipc.applyStashFiles).toHaveBeenCalledWith(1, {
        id: ID,
        tracked: ["b.txt"],
        untracked: ["new.txt"],
      });
    });
  });

  it("asks before dropping, naming the stash", async () => {
    const user = userEvent.setup();
    ipc.dropStash.mockResolvedValue({ status: "ok", data: "Dropped" });
    renderWith(<Stashes repoId={1} repoPath="/repo" />);
    await user.click(await screen.findByRole("button", { name: "Actions for stash@{0}" }));
    await user.click(await screen.findByRole("menuitem", { name: "Drop…" }));
    const dialog = await screen.findByRole("dialog", { name: "Drop stash@{0}?" });
    expect(dialog).toHaveTextContent("half done");
    expect(ipc.dropStash).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Drop" }));
    await waitFor(() => {
      expect(ipc.dropStash).toHaveBeenCalledWith(1, { index: 0, id: ID });
    });
  });

  it("pops with the staged changes when asked", async () => {
    const user = userEvent.setup();
    ipc.applyStash.mockResolvedValue({ status: "ok", data: { output: "", conflicts: false } });
    useShownStashStore.setState({
      shown: { "/repo": { id: ID, chosen: [] } },
      restoreIndex: false,
    });
    renderWith(<StashBody repoId={1} repoPath="/repo" />);
    await user.click(await screen.findByRole("checkbox", { name: "Restore staged changes too" }));
    await user.click(screen.getByRole("button", { name: "Pop" }));
    await waitFor(() => {
      expect(ipc.applyStash).toHaveBeenCalledWith(1, {
        stash: { index: 0, id: ID },
        pop: true,
        restoreIndex: true,
      });
    });
  });
});
