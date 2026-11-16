import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useTabsStore } from "@/features/workspace";
import type { TreeListingDto } from "@/shared/ipc/bindings";

import { useFilesStore } from "../store/files";
import { FileTree } from "./FileTree";

const ipc = vi.hoisted(() => ({ listTree: vi.fn(), searchTree: vi.fn() }));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const LISTINGS: Record<string, TreeListingDto> = {
  root: {
    entries: [
      { name: "src", kind: "folder", id: "t-src" },
      { name: "README.md", kind: "file", id: "b-readme" },
    ],
    total: 2,
  },
  "t-src": { entries: [{ name: "main.rs", kind: "file", id: "b-main" }], total: 1 },
};

function renderTree() {
  ipc.listTree.mockImplementation((_repoId: number, treeId: string) =>
    Promise.resolve({ status: "ok", data: LISTINGS[treeId] }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FileTree
        repoId={1}
        repoPath="/repo"
        rootId="root"
        commit="0123456789abcdef0123456789abcdef01234567"
        label="Files at 01234567"
      />
    </QueryClientProvider>,
  );
}

describe("FileTree", () => {
  beforeEach(() => {
    useFilesStore.setState({ expanded: {}, cursor: {}, chosen: {}, filter: {} });
    useTabsStore.setState({ tabs: [], activeTabId: null, activeRepositoryTabId: null });
  });

  it("opens folders on click and shows a file in the file tab", async () => {
    const user = userEvent.setup();
    renderTree();
    const tree = await screen.findByRole("tree", { name: "Files at 01234567" });
    expect(tree).toBeVisible();
    await user.click(await screen.findByRole("treeitem", { name: "src, folder" }));
    const file = await screen.findByRole("treeitem", { name: "main.rs, file" });
    expect(file).toHaveAttribute("aria-level", "2");
    expect(screen.getByRole("treeitem", { name: "src, folder, open" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await user.click(file);
    expect(useFilesStore.getState().chosen["/repo"]).toBe("src/main.rs");
    expect(useTabsStore.getState().activeTabId).toBe("file");
  });

  it("opens, enters and leaves folders with the arrow keys", async () => {
    const user = userEvent.setup();
    renderTree();
    const tree = await screen.findByRole("tree");
    await screen.findByRole("treeitem", { name: "src, folder" });
    tree.focus();
    await user.keyboard("{ArrowDown}{ArrowRight}");
    await screen.findByRole("treeitem", { name: "main.rs, file" });
    await user.keyboard("{ArrowRight}");
    await waitFor(() => {
      expect(useFilesStore.getState().chosen["/repo"]).toBeUndefined();
      expect(useFilesStore.getState().cursor["/repo"]).toBe("src/main.rs");
    });
    await user.keyboard("{ArrowLeft}");
    expect(useFilesStore.getState().cursor["/repo"]).toBe("src");
    await user.keyboard("{ArrowLeft}");
    expect(screen.queryByRole("treeitem", { name: "main.rs, file" })).toBeNull();
  });

  it("shows what the filter found in the whole tree, and the tree again once cleared", async () => {
    ipc.searchTree.mockResolvedValue({
      status: "ok",
      data: {
        rows: [
          {
            path: "src",
            depth: 0,
            entry: { name: "src", kind: "folder", id: "t-src" },
            matched: false,
          },
          {
            path: "src/main.rs",
            depth: 1,
            entry: { name: "main.rs", kind: "file", id: "b-main" },
            matched: true,
          },
        ],
        matches: 1,
        complete: true,
      },
    });
    const user = userEvent.setup();
    renderTree();
    await screen.findByRole("treeitem", { name: "README.md, file" });
    useFilesStore.getState().setFilter("/repo", "main");
    const found = await screen.findByRole("treeitem", { name: "main.rs, file" });
    expect(ipc.searchTree).toHaveBeenCalledWith(1, "root", "main");
    expect(screen.queryByRole("treeitem", { name: "README.md, file" })).toBeNull();
    await user.click(found);
    // Closing a folder of the result hides what is in it.
    await user.click(screen.getByRole("treeitem", { name: "src, folder, open" }));
    expect(screen.queryByRole("treeitem", { name: "main.rs, file" })).toBeNull();
    useFilesStore.getState().setFilter("/repo", "");
    useFilesStore.getState().reveal("/repo", "src/main.rs");
    expect(await screen.findByRole("treeitem", { name: "README.md, file" })).toBeVisible();
    expect(await screen.findByRole("treeitem", { name: "main.rs, file" })).toBeVisible();
  });

  it("says when nothing matches", async () => {
    ipc.searchTree.mockResolvedValue({
      status: "ok",
      data: { rows: [], matches: 0, complete: true },
    });
    renderTree();
    useFilesStore.getState().setFilter("/repo", "nothing");
    expect(await screen.findByText("No file matches")).toBeVisible();
  });
});
