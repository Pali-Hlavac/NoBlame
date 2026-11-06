import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RefEntry } from "@/shared/ipc/bindings";

import { openBranchDialog } from "../store/dialog";
import { BranchDialogs } from "./BranchDialogs";

const ipc = vi.hoisted(() => ({
  listRefs: vi.fn(),
  createBranch: vi.fn(),
  createTag: vi.fn(),
  renameBranch: vi.fn(),
  getUniqueCommits: vi.fn(),
  deleteRef: vi.fn(),
  checkoutCommit: vi.fn(),
  getStatus: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const ID = "0123456789abcdef0123456789abcdef01234567";

function ref(kind: RefEntry["label"]["kind"], name: string): RefEntry {
  return { label: { kind, name, isHead: name === "main" }, target: ID, row: 0, commitTime: 0 };
}

function renderDialogs() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BranchDialogs />
    </QueryClientProvider>,
  );
}

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok", data });
}

describe("branch dialogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.listRefs.mockReturnValue(ok([ref("branch", "main"), ref("tag", "v1")]));
    ipc.getStatus.mockReturnValue(ok(null));
  });

  it("creates a branch, refusing a name that exists", async () => {
    const user = userEvent.setup();
    ipc.createBranch.mockReturnValue(ok(""));
    renderDialogs();
    act(() => {
      openBranchDialog({
        kind: "create-branch",
        repoId: 1,
        start: { revision: ID, label: "01234567 Fix" },
      });
    });
    const name = await screen.findByLabelText("Branch name");
    await user.type(name, "main");
    expect(await screen.findByText("A branch named “main” exists already.")).toBeVisible();
    const submit = screen.getByRole("button", { name: "Create and check out" });
    expect(submit).toBeDisabled();
    await user.clear(name);
    await user.type(name, "topic");
    await user.click(screen.getByLabelText("Check out the new branch"));
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(ipc.createBranch).toHaveBeenCalledWith(1, {
      name: "topic",
      start: ID,
      checkout: false,
      track: false,
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("checks out a remote branch as a tracking branch named after it", async () => {
    const user = userEvent.setup();
    ipc.createBranch.mockReturnValue(ok(""));
    renderDialogs();
    act(() => {
      openBranchDialog({
        kind: "checkout-remote",
        repoId: 1,
        remote: { namespace: "remote", name: "origin/feature/x", target: ID },
      });
    });
    expect(await screen.findByLabelText("Branch name")).toHaveValue("feature/x");
    await user.click(screen.getByRole("button", { name: "Create and check out" }));
    expect(ipc.createBranch).toHaveBeenCalledWith(1, {
      name: "feature/x",
      start: "refs/remotes/origin/feature/x",
      checkout: true,
      track: true,
    });
  });

  it("shows what git said when it refuses", async () => {
    const user = userEvent.setup();
    ipc.createTag.mockReturnValue(
      Promise.resolve({
        status: "error",
        error: { code: "gitFailed", message: "fatal: tag 'v2' already exists", hint: null },
      }),
    );
    renderDialogs();
    act(() => {
      openBranchDialog({ kind: "create-tag", repoId: 1, start: { revision: ID, label: "x" } });
    });
    await user.type(await screen.findByLabelText("Tag name"), "v2");
    await user.type(screen.getByLabelText(/Message/), "Release two");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(ipc.createTag).toHaveBeenCalledWith(1, {
      name: "v2",
      target: ID,
      message: "Release two",
    });
    expect(await screen.findByText(/tag 'v2' already exists/)).toBeVisible();
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("names the commits only a branch holds before deleting it", async () => {
    const user = userEvent.setup();
    ipc.getUniqueCommits.mockReturnValue(
      ok({
        count: 4,
        newest: [
          { id: ID, summary: "Newest work" },
          { id: "1".repeat(40), summary: "Older work" },
        ],
      }),
    );
    ipc.deleteRef.mockReturnValue(ok(""));
    renderDialogs();
    const topic = { namespace: "branch", name: "topic", target: ID } as const;
    act(() => {
      openBranchDialog({ kind: "delete", repoId: 1, reference: topic });
    });
    expect(await screen.findByText(/4 commits are on no other branch or tag/)).toBeVisible();
    expect(screen.getByText("01234567 Newest work")).toBeVisible();
    expect(screen.getByText("and 2 older commits")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(ipc.deleteRef).toHaveBeenCalledWith(1, topic);
  });

  it("says when only the name goes", async () => {
    ipc.getUniqueCommits.mockReturnValue(ok({ count: 0, newest: [] }));
    renderDialogs();
    act(() => {
      openBranchDialog({
        kind: "delete",
        repoId: 1,
        reference: { namespace: "tag", name: "v1", target: ID },
      });
    });
    expect(await screen.findByText(/only the name goes/)).toBeVisible();
    expect(screen.getByText(/A copy already pushed to a remote stays there/)).toBeVisible();
  });
});
