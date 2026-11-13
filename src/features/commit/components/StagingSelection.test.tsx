import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { useSelectionStore } from "@/features/selection";
import type { WorkingFileDto, WorkingTreeStatusDto } from "@/shared/ipc/bindings";

import { StagingLists } from "./StagingLists";

const ipc = vi.hoisted(() => ({ getStatus: vi.fn(), stageFiles: vi.fn(), discardFiles: vi.fn() }));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

function file(path: string): WorkingFileDto {
  return {
    path,
    previousPath: null,
    status: "modified",
    oldId: null,
    newId: null,
    worktree: true,
    submodule: false,
    submoduleChanges: null,
  };
}

const PATHS = ["a.ts", "b.ts", "c.ts", "d.ts"];

const STATUS: WorkingTreeStatusDto = {
  summary: {
    staged: 0,
    unstaged: PATHS.length,
    untracked: 0,
    conflicted: 0,
    changes: { added: 0, changed: PATHS.length, deleted: 0 },
  },
  staged: [],
  unstaged: PATHS.map(file),
  operation: null,
  stagedOutside: 0,
};

async function renderList(): Promise<HTMLElement> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <StagingLists repoId={1} repoPath="/repo" showDiff={false} />
    </QueryClientProvider>,
  );
  return screen.findByRole("listbox", { name: "Changes" });
}

function row(list: HTMLElement, path: string): HTMLElement {
  return within(list).getByRole("option", { name: new RegExp(`^${path}`) });
}

function chosen(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole("option", { selected: true })
    .map((option) => option.getAttribute("aria-label")?.split(",")[0] ?? "");
}

describe("choosing several files in the Commit lists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSelectionStore.setState({ selections: {}, files: {} });
    ipc.getStatus.mockResolvedValue({ status: "ok", data: STATUS });
    ipc.stageFiles.mockResolvedValue({ status: "ok", data: null });
  });

  it("adds files with Ctrl+click and stages them all with Space", async () => {
    const list = await renderList();
    fireEvent.mouseDown(row(list, "a.ts"));
    fireEvent.mouseDown(row(list, "c.ts"), { ctrlKey: true });
    expect(chosen(list)).toEqual(["a.ts", "c.ts"]);
    fireEvent.keyDown(list, { key: " " });
    await waitFor(() => {
      expect(ipc.stageFiles).toHaveBeenCalledWith(1, ["a.ts", "c.ts"]);
    });
  });

  it("chooses a range with Shift+click and adds one with Ctrl+Shift+click", async () => {
    const list = await renderList();
    fireEvent.mouseDown(row(list, "b.ts"));
    fireEvent.mouseDown(row(list, "d.ts"), { shiftKey: true });
    expect(chosen(list)).toEqual(["b.ts", "c.ts", "d.ts"]);
    fireEvent.mouseDown(row(list, "a.ts"));
    fireEvent.mouseDown(row(list, "a.ts"), { ctrlKey: true });
    fireEvent.mouseDown(row(list, "c.ts"), { ctrlKey: true });
    fireEvent.mouseDown(row(list, "d.ts"), { ctrlKey: true, shiftKey: true });
    expect(chosen(list)).toEqual(["c.ts", "d.ts"]);
  });

  it("chooses all with Ctrl+A and offers the menu for all of them", async () => {
    const list = await renderList();
    fireEvent.mouseDown(row(list, "b.ts"));
    fireEvent.keyDown(list, { key: "a", ctrlKey: true });
    expect(chosen(list)).toEqual(PATHS);
    fireEvent.mouseDown(row(list, "c.ts"), { button: 2 });
    fireEvent.contextMenu(row(list, "c.ts"));
    const menu = await screen.findByRole("menu", { name: "Actions for 4 files" });
    expect(within(menu).getByRole("menuitem", { name: "Stage 4 files" })).toBeVisible();
    expect(
      within(menu).getByRole("menuitem", { name: "Discard the changes to 4 files…" }),
    ).toBeVisible();
  });

  it("stages every chosen file from one row's button", async () => {
    const list = await renderList();
    fireEvent.mouseDown(row(list, "a.ts"));
    fireEvent.mouseDown(row(list, "b.ts"), { shiftKey: true });
    fireEvent.click(within(row(list, "a.ts")).getByRole("button", { name: "Stage 2 files" }));
    await waitFor(() => {
      expect(ipc.stageFiles).toHaveBeenCalledWith(1, ["a.ts", "b.ts"]);
    });
  });
});
