import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { DiffLineDto, FileDiffDto } from "@/shared/ipc/bindings";

import type { DiffFile } from "../lib/diffFile";
import { FileDiffView } from "./FileDiffView";

const ipc = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getFileDiff: vi.fn(),
  getDiffLines: vi.fn(),
  stageLines: vi.fn(),
  unstageLines: vi.fn(),
  discardLines: vi.fn(),
}));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const INDEX = "1111111111111111111111111111111111111111";
const DISK = "2222222222222222222222222222222222222222";

const FILE: DiffFile = {
  path: "a.txt",
  previousPath: null,
  status: "modified",
  oldId: INDEX,
  newId: DISK,
  worktree: true,
  submodule: false,
};

const SUMMARY: FileDiffDto = {
  content: "text",
  rows: 4,
  splitRows: 3,
  additions: 1,
  deletions: 1,
  hunks: 1,
  oldLines: 2,
  newLines: 2,
  oldSize: "8",
  newSize: "8",
};

function row(kind: DiffLineDto["kind"], oldLine: number | null, newLine: number | null, text = "") {
  return { kind, oldLine, newLine, text, truncated: false, highlights: [], syntax: [] };
}

const ROWS: DiffLineDto[] = [
  row("hunk", null, null, "@@ -1,2 +1,2 @@"),
  row("context", 1, 1, "one"),
  row("removed", 2, null, "two"),
  row("added", null, 2, "2"),
];

function renderView(staging: "worktree" | "index" | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FileDiffView repoId={1} file={FILE} staging={staging} />
    </QueryClientProvider>,
  );
}

const ADDED_LINE = { start: 2, end: 2 };

describe("FileDiffView line staging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.getSettings.mockResolvedValue({ status: "ok", data: {} });
    ipc.getFileDiff.mockResolvedValue({ status: "ok", data: SUMMARY });
    ipc.getDiffLines.mockResolvedValue({ status: "ok", data: ROWS });
    for (const command of [ipc.stageLines, ipc.unstageLines, ipc.discardLines]) {
      command.mockResolvedValue({ status: "ok", data: null });
    }
  });

  it("stages a hunk with its button", async () => {
    renderView("worktree");
    fireEvent.click(await screen.findByRole("button", { name: "Stage hunk" }));
    await waitFor(() => {
      expect(ipc.stageLines).toHaveBeenCalledWith(1, {
        path: "a.txt",
        oldId: INDEX,
        newId: DISK,
        removed: [{ start: 1, end: 2 }],
        added: [{ start: 1, end: 2 }],
      });
    });
  });

  it("stages the lines chosen by their numbers", async () => {
    renderView("worktree");
    // Removed line 2 comes first, then added line 2.
    const added = (await screen.findAllByRole("button", { name: "Choose line 2" })).at(-1);
    if (!added) throw new Error("no button for the added line");
    fireEvent.click(added);
    const bar = screen.getByRole("toolbar", { name: "Chosen lines" });
    expect(bar).toHaveTextContent("1 line chosen");
    fireEvent.click(within(bar).getByRole("button", { name: "Stage 1 line" }));
    await waitFor(() => {
      expect(ipc.stageLines).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ removed: [], added: [ADDED_LINE] }),
      );
    });
  });

  it("asks before discarding a hunk", async () => {
    renderView("worktree");
    fireEvent.click(await screen.findByRole("button", { name: "Discard hunk…" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Discard the hunk at lines 1–2 in a.txt?",
    });
    expect(ipc.discardLines).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Discard" }));
    await waitFor(() => {
      expect(ipc.discardLines).toHaveBeenCalledTimes(1);
    });
  });

  it("offers unstaging in a staged diff and nothing for a commit", async () => {
    renderView("index");
    expect(await screen.findByRole("button", { name: "Unstage hunk" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Stage hunk" })).toBeNull();
  });

  it("has no line actions for a commit's diff", async () => {
    renderView(undefined);
    expect(await screen.findByText("two")).toBeVisible();
    expect(screen.queryByRole("button", { name: /hunk/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Choose line/ })).toBeNull();
  });
});
