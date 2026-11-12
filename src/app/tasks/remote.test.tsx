import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RepoSummary } from "@/shared/ipc/bindings";

import { REMOTE_SPECS } from "./remote";
import { useRemoteTaskStore } from "./remoteTask";
import { RemoteTaskDialog } from "./RemoteTaskDialog";
import type { TaskTarget } from "./specs";

const mocks = vi.hoisted(() => ({
  openBranchDialog: vi.fn(),
  startJob: vi.fn(),
  startPull: vi.fn(),
  startFetch: vi.fn(),
}));
vi.mock("@/features/branches", () => ({ openBranchDialog: mocks.openBranchDialog }));
vi.mock("@/features/jobs", () => ({
  startJob: mocks.startJob,
  startPull: mocks.startPull,
  startFetch: mocks.startFetch,
}));

function target(head: RepoSummary["head"]): TaskTarget {
  const summary = { id: 5, name: "app", path: "/work/app", head } as RepoSummary;
  return { path: "/work/app", summary, scope: { relative: "", isFolder: true } };
}
const ON_MAIN = target({ kind: "branch", name: "main" });
const DETACHED = target({ kind: "detached", id: "a".repeat(40) });

describe("Fetch, Pull and Push windows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRemoteTaskStore.setState({ open: null });
    mocks.startPull.mockReturnValue("pull-job");
  });

  it("need HEAD on a branch to pull or push, not to fetch", async () => {
    await expect(REMOTE_SPECS.pull?.prepare?.(DETACHED)).rejects.toThrow(/not on a branch/);
    await expect(REMOTE_SPECS.push?.prepare?.(DETACHED)).rejects.toThrow(/not on a branch/);
    expect(REMOTE_SPECS.fetch?.prepare).toBeUndefined();
    await expect(REMOTE_SPECS.pull?.prepare?.(ON_MAIN)).resolves.toBeUndefined();
  });

  it("push opens the Push dialog of the current branch", () => {
    REMOTE_SPECS.push?.start?.(ON_MAIN);
    expect(mocks.openBranchDialog).toHaveBeenCalledWith({
      kind: "push-branch",
      repoId: 5,
      branch: "main",
    });
  });

  it("pull asks how, then runs the job and shows its output", async () => {
    const user = userEvent.setup();
    render(<RemoteTaskDialog repoPath="/work/app" branch="main" />);
    REMOTE_SPECS.pull?.start?.(ON_MAIN);
    expect(await screen.findByRole("dialog", { name: "Pull into main" })).toBeVisible();
    await user.click(screen.getByRole("radio", { name: "Pull (rebase)" }));
    await user.click(screen.getByRole("button", { name: "Pull" }));
    expect(mocks.startPull).toHaveBeenCalledWith({ path: "/work/app", mode: "rebase" });
    expect(mocks.startJob).toHaveBeenCalledWith("pull-job", "pull");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("fetch asks which, and Cancel runs nothing", async () => {
    const user = userEvent.setup();
    render(<RemoteTaskDialog repoPath="/work/app" branch="main" />);
    REMOTE_SPECS.fetch?.start?.(ON_MAIN);
    expect(await screen.findByRole("radio", { name: "Fetch all remotes" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.startJob).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
