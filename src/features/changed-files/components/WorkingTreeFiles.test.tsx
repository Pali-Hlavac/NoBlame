import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";

import { useSelectionStore } from "@/features/selection";
import { useTabsStore } from "@/features/workspace";
import type { WorkingFileDto, WorkingTreeStatusDto } from "@/shared/ipc/bindings";

import { WorkingTreeFiles } from "./WorkingTreeFiles";

const ipc = vi.hoisted(() => ({ getStatus: vi.fn() }));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const INDEX = "1111111111111111111111111111111111111111";

function file(path: string, status: WorkingFileDto["status"], worktree = true): WorkingFileDto {
  return {
    path,
    previousPath: null,
    status,
    oldId: INDEX,
    newId: null,
    worktree,
    submodule: false,
    submoduleChanges: null,
  };
}

const STATUS: WorkingTreeStatusDto = {
  summary: {
    staged: 1,
    unstaged: 1,
    untracked: 1,
    conflicted: 1,
    changes: { added: 0, changed: 0, deleted: 0 },
  },
  staged: [{ ...file("src/staged.ts", "added", false), oldId: null, newId: INDEX }],
  operation: null,
  unstaged: [
    file("src/both.ts", "conflicted"),
    file("src/main.ts", "modified"),
    file("notes.txt", "untracked"),
  ],
};

function renderFiles(kind: "worktree" | "index") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <WorkingTreeFiles repoId={1} repoPath="/repo" kind={kind} />
    </QueryClientProvider>,
  );
}

describe("WorkingTreeFiles", () => {
  beforeEach(() => {
    useSelectionStore.setState({ files: {} });
    useTabsStore.setState({ tabs: [], activeTabId: null, activeRepositoryTabId: null });
    ipc.getStatus.mockResolvedValue({ status: "ok", data: STATUS });
  });

  it("lists changed, untracked and conflicted files and chooses one", async () => {
    renderFiles("worktree");
    expect(await screen.findByText("3 files changed")).toBeVisible();
    expect(screen.getByRole("option", { name: "both.ts, conflicted, in src" })).toBeVisible();
    expect(screen.getByRole("option", { name: "notes.txt, untracked" })).toBeVisible();
    fireEvent.mouseDown(screen.getByRole("option", { name: "main.ts, modified, in src" }));
    expect(useSelectionStore.getState().files["/repo"]).toBe("src/main.ts");
  });

  it("lists staged files", async () => {
    renderFiles("index");
    expect(await screen.findByText("1 file staged")).toBeVisible();
    expect(screen.getByRole("option", { name: "staged.ts, added, in src" })).toBeVisible();
  });

  it("says when nothing is staged", async () => {
    ipc.getStatus.mockResolvedValue({
      status: "ok",
      data: { ...STATUS, summary: { ...STATUS.summary, staged: 0 }, staged: [] },
    });
    renderFiles("index");
    expect(await screen.findByText("Nothing is staged.")).toBeVisible();
  });
});
