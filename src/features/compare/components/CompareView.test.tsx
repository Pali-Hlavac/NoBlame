import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useSelectionStore } from "@/features/selection";
import { useTabsStore } from "@/features/workspace";
import type { ChangedFileDto, ComparisonDto } from "@/shared/ipc/bindings";

import { ComparisonView } from "./CompareView";

const ipc = vi.hoisted(() => ({
  getComparison: vi.fn(),
  countAheadBehind: vi.fn(),
  listRefs: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/diff", () => ({
  FileDiffView: ({ file }: { file: ChangedFileDto }) => <p>Diff of {file.path}</p>,
}));

const MAIN = "1111111111111111111111111111111111111111";
const FEATURE = "2222222222222222222222222222222222222222";

function file(path: string, status: ChangedFileDto["status"]): ChangedFileDto {
  return { path, previousPath: null, status, oldId: MAIN, newId: FEATURE, submodule: false };
}

const RESULT: ComparisonDto = {
  base: { id: MAIN, summary: "Main work", authorName: "Ada", authorTime: 0 },
  target: { id: FEATURE, summary: "Feature work", authorName: "Ada", authorTime: 0 },
  mergeBase: null,
  files: [file("src/lib.rs", "modified"), file("README.md", "added")],
  total: 2,
  exactRenamesOnly: false,
};

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ComparisonView repoId={1} repoPath="/repo" />
    </QueryClientProvider>,
  );
}

describe("ComparisonView", () => {
  beforeEach(() => {
    useSelectionStore.setState({ comparisons: {} });
    useTabsStore.setState({ tabs: [], activeTabId: null, activeRepositoryTabId: null });
    ipc.getComparison.mockResolvedValue({ status: "ok", data: RESULT });
    ipc.countAheadBehind.mockResolvedValue({ status: "ok", data: { ahead: 2, behind: 1 } });
    ipc.listRefs.mockResolvedValue({ status: "ok", data: [] });
  });

  it("asks for both sides before comparing", () => {
    renderView();
    expect(screen.getByText("Choose what to compare")).toBeVisible();
    expect(screen.getByRole("button", { name: "Compare to: Choose…" })).toBeVisible();
    expect(ipc.getComparison).not.toHaveBeenCalled();
  });

  it("lists the files that differ and shows the chosen one's diff", async () => {
    useSelectionStore.setState({
      comparisons: {
        "/repo": { base: "refs/heads/main", target: "refs/heads/feature", sinceMergeBase: false },
      },
    });
    renderView();
    expect(
      await screen.findByText("2 files differ · 2 commits only in feature, 1 only in main"),
    ).toBeVisible();
    expect(ipc.getComparison).toHaveBeenCalledWith(1, {
      base: "refs/heads/main",
      target: "refs/heads/feature",
      sinceMergeBase: false,
    });
    expect(ipc.countAheadBehind).toHaveBeenCalledWith(1, MAIN, FEATURE);
    // The split's separator claims pointer presses at (0, 0), where jsdom puts everything.
    fireEvent.mouseDown(screen.getByRole("option", { name: /^lib\.rs, modified/ }));
    expect(screen.getByText("Diff of src/lib.rs")).toBeVisible();
  });

  it("swaps the sides and compares since the merge base", async () => {
    const user = userEvent.setup();
    useSelectionStore.setState({
      comparisons: { "/repo": { base: "HEAD", target: "v1.0", sinceMergeBase: false } },
    });
    renderView();
    await user.click(screen.getByRole("button", { name: "Swap the two sides" }));
    await user.click(screen.getByRole("checkbox", { name: "Only changes since they split" }));
    expect(useSelectionStore.getState().comparisons["/repo"]).toEqual({
      base: "v1.0",
      target: "HEAD",
      sinceMergeBase: true,
    });
    await waitFor(() => {
      expect(ipc.getComparison).toHaveBeenLastCalledWith(1, {
        base: "v1.0",
        target: "HEAD",
        sinceMergeBase: true,
      });
    });
  });
});
