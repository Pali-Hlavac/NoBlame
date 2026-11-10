import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import type { PointerCommitDto } from "@/shared/ipc/bindings";

import type { DiffFile } from "../lib/diffFile";
import { insideText, pointerChange, pointerText, submoduleFolder } from "../lib/submodule";
import { FileDiffView } from "./FileDiffView";

const ipc = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getSubmoduleLog: vi.fn(),
  openExternalDiff: vi.fn(),
}));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const OLD = "a".repeat(40);
const NEW = "b".repeat(40);

const MODULE: DiffFile = {
  path: "deps/leaf",
  previousPath: null,
  status: "modified",
  oldId: OLD,
  newId: NEW,
  submodule: true,
};

function commit(id: string, summary: string): PointerCommitDto {
  return { id: id.repeat(40), summary, author: "Ada", time: 1_600_000_000 };
}

function renderView(file: DiffFile) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FileDiffView repoId={1} file={file} />
    </QueryClientProvider>,
  );
}

describe("submodule pointers", () => {
  it("say how the pointer moved", () => {
    expect(pointerText(pointerChange(MODULE), undefined)).toBe(
      "Its commit changed from aaaaaaaa to bbbbbbbb.",
    );
    expect(pointerText(pointerChange({ ...MODULE, oldId: null }), undefined)).toBe(
      "Added at bbbbbbbb.",
    );
    const disk = { ...MODULE, newId: null, worktree: true };
    expect(pointerChange(disk)).toEqual({ kind: "changed", from: OLD, to: null });
    expect(pointerText(pointerChange(disk), NEW)).toBe(
      "Checked out at bbbbbbbb; the repository records aaaaaaaa.",
    );
    expect(insideText({ newCommits: true, modified: true, untracked: true })).toBe(
      "It also has changed files and untracked files of its own.",
    );
    expect(insideText({ newCommits: true, modified: false, untracked: false })).toBeNull();
    expect(submoduleFolder("C:\\r\\app\\", "deps/leaf")).toBe("C:\\r\\app\\deps\\leaf");
    expect(submoduleFolder("/r/app", "deps/leaf")).toBe("/r/app/deps/leaf");
  });
});

describe("the diff of a submodule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.getSettings.mockResolvedValue({ status: "ok", data: {} });
  });

  it("lists the commits added and removed between the pointers", async () => {
    ipc.getSubmoduleLog.mockResolvedValue({
      status: "ok",
      data: {
        kind: "log",
        to: NEW,
        added: [commit("c", "Fix the parser"), commit("d", "Add a test")],
        removed: [commit("e", "Old idea")],
        moreAdded: false,
        moreRemoved: false,
      },
    });
    renderView(MODULE);
    expect(await screen.findByText("Fix the parser")).toBeInTheDocument();
    expect(ipc.getSubmoduleLog).toHaveBeenCalledWith(1, "deps/leaf", OLD, NEW);
    expect(screen.getByRole("region", { name: "2 commits added" })).toBeInTheDocument();
    expect(screen.getByText("Old idea")).toBeInTheDocument();
  });

  it("says when the submodule's clone lacks the commits", async () => {
    ipc.getSubmoduleLog.mockResolvedValue({ status: "ok", data: { kind: "missing" } });
    renderView(MODULE);
    expect(await screen.findByText(/does not have these commits/)).toBeInTheDocument();
  });
});
