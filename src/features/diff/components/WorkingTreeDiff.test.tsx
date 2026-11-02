import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import type { WorkingFileDto, WorkingTreeStatusDto } from "@/shared/ipc/bindings";

import type { DiffFile } from "../lib/diffFile";
import { WorkingTreeDiff } from "./WorkingTreeDiff";

const ipc = vi.hoisted(() => ({ getStatus: vi.fn(), getWorktreeFileId: vi.fn() }));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("./FileDiffView", () => ({
  FileDiffView: ({ file }: { file: DiffFile }) => (
    <p>
      {file.path}: {file.oldId ?? "none"} → {file.newId ?? "none"}
      {file.worktree ? " (working tree)" : ""}
    </p>
  ),
}));

const HEAD = "1111111111111111111111111111111111111111";
const INDEX = "2222222222222222222222222222222222222222";
const DISK = "3333333333333333333333333333333333333333";

function file(path: string, overrides: Partial<WorkingFileDto>): WorkingFileDto {
  return {
    path,
    previousPath: null,
    status: "modified",
    oldId: INDEX,
    newId: null,
    worktree: true,
    submodule: false,
    ...overrides,
  };
}

const STATUS: WorkingTreeStatusDto = {
  summary: { staged: 1, unstaged: 2, untracked: 0, conflicted: 0 },
  staged: [file("a.txt", { oldId: HEAD, newId: INDEX, worktree: false })],
  unstaged: [file("a.txt", {}), file("gone.txt", { status: "deleted", worktree: false })],
};

function renderDiff(kind: "worktree" | "index", path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <WorkingTreeDiff repoId={1} kind={kind} path={path} />
    </QueryClientProvider>,
  );
}

describe("WorkingTreeDiff", () => {
  beforeEach(() => {
    ipc.getStatus.mockResolvedValue({ status: "ok", data: STATUS });
    ipc.getWorktreeFileId.mockResolvedValue({ status: "ok", data: DISK });
  });

  it("compares a staged file's HEAD version with the index", async () => {
    renderDiff("index", "a.txt");
    expect(await screen.findByText(`a.txt: ${HEAD} → ${INDEX}`)).toBeVisible();
    expect(ipc.getWorktreeFileId).not.toHaveBeenCalled();
  });

  it("compares a changed file's index version with the file on disk", async () => {
    renderDiff("worktree", "a.txt");
    expect(await screen.findByText(`a.txt: ${INDEX} → ${DISK} (working tree)`)).toBeVisible();
    expect(ipc.getWorktreeFileId).toHaveBeenCalledWith(1, "a.txt");
  });

  it("shows a file deleted from the working tree without reading it", async () => {
    renderDiff("worktree", "gone.txt");
    expect(await screen.findByText(`gone.txt: ${INDEX} → none`)).toBeVisible();
    expect(ipc.getWorktreeFileId).not.toHaveBeenCalled();
  });

  it("says when the chosen file has no changes any more", async () => {
    renderDiff("index", "gone.txt");
    expect(await screen.findByText("Not staged")).toBeVisible();
  });
});
