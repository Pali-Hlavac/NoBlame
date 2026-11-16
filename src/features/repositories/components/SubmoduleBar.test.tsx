import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { WorkingFileDto } from "@/shared/ipc/bindings";

import { driftKey, driftedPaths } from "../lib/drift";
import { useSubmoduleBarStore } from "../store/submoduleBar";
import { useSubmoduleUpdateStore } from "../store/submoduleUpdate";
import { SubmoduleBar } from "./SubmoduleBar";

const ipc = vi.hoisted(() => ({
  getStatus: vi.fn(),
  listSubmodules: vi.fn(),
  updateSubmodules: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/jobs", () => ({ startJob: vi.fn(), afterJob: vi.fn() }));

const moved = (path: string, newCommits: boolean): WorkingFileDto => ({
  path,
  previousPath: null,
  status: "modified",
  oldId: null,
  newId: null,
  worktree: true,
  submodule: true,
  submoduleChanges: { newCommits, modified: false, untracked: false },
});

function statusWith(files: WorkingFileDto[]) {
  return {
    status: "ok",
    data: {
      summary: {
        staged: 0,
        unstaged: files.length,
        untracked: 0,
        conflicted: 0,
        changes: { added: 0, changed: files.length, deleted: 0 },
      },
      staged: [],
      unstaged: files,
      operation: null,
    },
  };
}

function renderBar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SubmoduleBar repoId={1} path="/r/app" />
    </QueryClientProvider>,
  );
}

describe("SubmoduleBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSubmoduleBarStore.setState({ dismissed: {} });
    ipc.listSubmodules.mockResolvedValue({ status: "ok", data: [] });
    ipc.updateSubmodules.mockResolvedValue({ status: "ok", data: 5 });
  });

  it("offers to update the submodules not on the recorded commits", async () => {
    ipc.getStatus.mockResolvedValue(
      statusWith([moved("libs/core", true), moved("libs/edited", false)]),
    );
    const user = userEvent.setup();
    renderBar();
    expect(
      await screen.findByText("libs/core is not on the commit this repository records."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Update it" }));
    expect(ipc.updateSubmodules).toHaveBeenCalledWith("/r/app", ["libs/core"]);
  });

  it("asks first when the list knows the submodule's commits", async () => {
    ipc.getStatus.mockResolvedValue(statusWith([moved("libs/core", true)]));
    ipc.listSubmodules.mockResolvedValue({
      status: "ok",
      data: [
        {
          name: "libs/core",
          path: "libs/core",
          workDir: "/r/app/libs/core",
          url: null,
          initialized: true,
          recorded: "1".repeat(40),
          checkedOut: "2".repeat(40),
          children: [],
        },
      ],
    });
    const user = userEvent.setup();
    useSubmoduleUpdateStore.setState({ request: null });
    renderBar();
    await user.click(await screen.findByRole("button", { name: "Update it" }));
    await vi.waitFor(() => {
      expect(useSubmoduleUpdateStore.getState().request?.paths).toEqual(["libs/core"]);
    });
    expect(ipc.updateSubmodules).not.toHaveBeenCalled();
  });

  it("stays hidden once dismissed, until the commits change", async () => {
    ipc.getStatus.mockResolvedValue(statusWith([moved("a", true), moved("b", true)]));
    const user = userEvent.setup();
    renderBar();
    await user.click(
      await screen.findByRole("button", { name: "Hide until the submodules change" }),
    );
    expect(screen.queryByText(/2 submodules are not/)).toBeNull();
    expect(useSubmoduleBarStore.getState().dismissed["/r/app"]).toBe("a@?>?|b@?>?");
  });

  it("names the state by the submodules' commits", () => {
    expect(driftedPaths(null)).toEqual([]);
    const submodules = [
      {
        name: "a",
        path: "a",
        workDir: "/r/app/a",
        url: null,
        initialized: true,
        recorded: "1",
        checkedOut: "2",
        children: [],
      },
    ];
    expect(driftKey(["a"], submodules)).toBe("a@1>2");
  });
});
