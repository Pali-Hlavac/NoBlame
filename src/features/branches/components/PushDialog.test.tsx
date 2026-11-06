import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RefEntry } from "@/shared/ipc/bindings";

import { openBranchDialog } from "../store/dialog";
import { BranchDialogs } from "./BranchDialogs";

const ipc = vi.hoisted(() => ({
  listRefs: vi.fn(),
  listRemotes: vi.fn(),
  getUpstreams: vi.fn(),
  getMissingCommits: vi.fn(),
  getUniqueCommits: vi.fn(),
  pushRepository: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/repositories", () => ({ useRepositoryPath: () => "C:/code/app" }));

const ID = "0123456789abcdef0123456789abcdef01234567";

function ref(kind: RefEntry["label"]["kind"], name: string): RefEntry {
  return { label: { kind, name, isHead: name === "main" }, target: ID, row: 0, commitTime: 0 };
}

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok", data });
}

function renderDialogs() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BranchDialogs />
    </QueryClientProvider>,
  );
}

describe("push dialogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.listRefs.mockReturnValue(
      ok([ref("branch", "main"), ref("branch", "topic"), ref("remote", "origin/main")]),
    );
    ipc.listRemotes.mockReturnValue(ok(["origin"]));
    ipc.getUpstreams.mockReturnValue(
      ok([{ branch: "main", upstream: "refs/remotes/origin/main", gone: false }]),
    );
    ipc.pushRepository.mockReturnValue(ok(1));
  });

  it("pushes a new branch and makes it the upstream", async () => {
    const user = userEvent.setup();
    renderDialogs();
    act(() => {
      openBranchDialog({ kind: "push-branch", repoId: 1, branch: "topic" });
    });
    expect(
      await screen.findByText("Creates topic on origin with the commits of topic."),
    ).toBeVisible();
    expect(screen.getByLabelText("Make it the upstream of topic")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Push" }));
    expect(ipc.pushRepository).toHaveBeenCalledWith({
      path: "C:/code/app",
      remote: "origin",
      what: {
        type: "branch",
        local: "topic",
        remoteBranch: "topic",
        setUpstream: true,
        followTags: false,
        force: false,
        expected: null,
      },
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("names the commits a force push removes before it runs", async () => {
    const user = userEvent.setup();
    ipc.getMissingCommits.mockReturnValue(
      ok({ count: 2, newest: [{ id: ID, summary: "Their fix" }] }),
    );
    renderDialogs();
    act(() => {
      openBranchDialog({ kind: "push-branch", repoId: 1, branch: "main" });
    });
    expect(await screen.findByLabelText("Make it the upstream of main")).not.toBeChecked();
    await user.click(screen.getByLabelText("Force: replace the branch there"));
    expect(await screen.findByText(/2 commits on origin\/main are not in main/)).toBeVisible();
    expect(screen.getByText(/Their fix/)).toBeVisible();
    expect(ipc.getMissingCommits).toHaveBeenCalledWith(
      1,
      "refs/remotes/origin/main",
      "refs/heads/main",
    );
    await user.click(screen.getByRole("button", { name: "Force push" }));
    expect(ipc.pushRepository).toHaveBeenCalledWith({
      path: "C:/code/app",
      remote: "origin",
      what: {
        type: "branch",
        local: "main",
        remoteBranch: "main",
        setUpstream: false,
        followTags: false,
        force: true,
        // The lease: origin/main where the dialog showed it.
        expected: ID,
      },
    });
  });

  it("deletes a remote branch on its remote after confirming", async () => {
    const user = userEvent.setup();
    ipc.getUniqueCommits.mockReturnValue(ok({ count: 0, newest: [] }));
    renderDialogs();
    act(() => {
      openBranchDialog({
        kind: "delete-on-remote",
        repoId: 1,
        reference: { namespace: "remote", name: "origin/feature/x", target: ID },
      });
    });
    expect(await screen.findByText("Delete feature/x on origin?")).toBeVisible();
    expect(await screen.findByText(/only the name goes/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Delete on origin" }));
    expect(ipc.pushRepository).toHaveBeenCalledWith({
      path: "C:/code/app",
      remote: "origin",
      what: { type: "delete", reference: "refs/heads/feature/x" },
    });
  });
});
