import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RefEntry } from "@/shared/ipc/bindings";

import { openBranchDialog } from "../store/dialog";
import { BranchDialogs } from "./BranchDialogs";
import { BranchRowView } from "./BranchRowView";

const ipc = vi.hoisted(() => ({
  listRefs: vi.fn(),
  setUpstream: vi.fn(),
  getUpstreams: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const ID = "0123456789abcdef0123456789abcdef01234567";

function ref(kind: RefEntry["label"]["kind"], name: string): RefEntry {
  return { label: { kind, name, isHead: false }, target: ID, row: 0, commitTime: 0 };
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

describe("set upstream dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.listRefs.mockReturnValue(
      ok([
        ref("branch", "main"),
        ref("branch", "topic"),
        ref("remote", "origin/topic"),
        ref("remote", "origin/main"),
      ]),
    );
    ipc.getUpstreams.mockReturnValue(ok([]));
  });

  it("suggests the remote branch of the same name and sets it by full name", async () => {
    const user = userEvent.setup();
    ipc.setUpstream.mockReturnValue(ok(""));
    renderDialogs();
    act(() => {
      openBranchDialog({ kind: "set-upstream", repoId: 1, branch: "topic", current: null });
    });
    const field = await screen.findByLabelText("Upstream branch");
    await waitFor(() => {
      expect(field).toHaveValue("origin/topic");
    });
    await user.clear(field);
    await user.type(field, "origin/nope");
    expect(await screen.findByText("There is no branch “origin/nope”.")).toBeVisible();
    await user.clear(field);
    await user.type(field, "origin/main");
    await user.click(screen.getByRole("button", { name: "Set upstream" }));
    expect(ipc.setUpstream).toHaveBeenCalledWith(1, {
      branch: "topic",
      upstream: "refs/remotes/origin/main",
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("starts from the current upstream when changing it", async () => {
    renderDialogs();
    act(() => {
      openBranchDialog({
        kind: "set-upstream",
        repoId: 1,
        branch: "topic",
        current: "refs/heads/main",
      });
    });
    expect(await screen.findByText("Change the upstream of topic")).toBeVisible();
    expect(screen.getByLabelText("Upstream branch")).toHaveValue("main");
  });
});

describe("branch row tracking", () => {
  const row = { type: "ref", entry: ref("branch", "topic"), display: "topic" } as const;
  const upstream = "refs/remotes/origin/topic";

  it("shows commits to push and pull, and says so in the tooltip", () => {
    const { container } = render(
      <BranchRowView
        row={row}
        active={false}
        showDate={false}
        tracking={{ upstream, gone: false, counts: { ahead: 2, behind: 5 } }}
      />,
    );
    expect(container).toHaveTextContent("25");
    expect(container.firstElementChild).toHaveAttribute(
      "title",
      expect.stringContaining("Tracks origin/topic: 2 commits to push, 5 commits to pull"),
    );
  });

  it("marks a gone upstream and shows nothing when even", () => {
    const { container, rerender } = render(
      <BranchRowView
        row={row}
        active={false}
        showDate={false}
        tracking={{ upstream, gone: true }}
      />,
    );
    expect(screen.getByText("gone")).toBeVisible();
    rerender(
      <BranchRowView
        row={row}
        active={false}
        showDate={false}
        tracking={{ upstream, gone: false, counts: { ahead: 0, behind: 0 } }}
      />,
    );
    expect(container).toHaveTextContent(/^topic$/);
  });
});
