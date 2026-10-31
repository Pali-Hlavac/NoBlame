import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useSelectionStore } from "@/features/selection";
import { useTabsStore } from "@/features/workspace";
import type { FileHistoryRowDto } from "@/shared/ipc/bindings";

import { HistoryList } from "./HistoryList";

const ipc = vi.hoisted(() => ({ getFileHistoryRows: vi.fn() }));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

function entry(overrides: Partial<FileHistoryRowDto>): FileHistoryRowDto {
  return {
    id: "0123456789abcdef0123456789abcdef01234567",
    row: 0,
    path: "src/main.rs",
    change: "modified",
    previousPath: null,
    summary: "Edit",
    authorName: "Ada",
    authorEmail: "ada@example.com",
    authorTime: 1_600_000_000,
    ...overrides,
  };
}

const ENTRIES = [
  entry({ row: 3, summary: "Tidy up" }),
  entry({ row: null, summary: "Hidden by the filter" }),
  entry({ row: 9, change: "renamed", previousPath: "main.rs", summary: "Move into src" }),
];

function renderList(folder = false) {
  ipc.getFileHistoryRows.mockResolvedValue({ status: "ok", data: ENTRIES });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <HistoryList
        repoId={1}
        repoPath="/repo"
        target={{ path: "src/main.rs", folder }}
        total={ENTRIES.length}
        generation={1}
      />
    </QueryClientProvider>,
  );
}

describe("HistoryList", () => {
  beforeEach(() => {
    useSelectionStore.setState({ selections: {}, files: {}, parents: {} });
    useTabsStore.setState({ tabs: [], activeTabId: null, activeRepositoryTabId: null });
  });

  it("selects the commit and shows the file's change under its name there", async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(await screen.findByRole("option", { name: /^Move into src, Ada/ }));
    expect(useSelectionStore.getState().selections["/repo"]).toEqual({ kind: "commit", row: 9 });
    expect(useSelectionStore.getState().files["/repo"]).toBe("src/main.rs");
    expect(useTabsStore.getState().activeTabId).toBe("diff");
    expect(screen.getByText("← main.rs")).toBeVisible();
  });

  it("leaves the selection alone for a commit the graph's filter hides", async () => {
    const user = userEvent.setup();
    renderList();
    const hidden = await screen.findByRole("option", { name: /hidden by the graph's filter$/ });
    await user.click(hidden);
    expect(useSelectionStore.getState().selections["/repo"]).toBeUndefined();
    expect(hidden).toHaveAttribute("aria-selected", "true");
  });

  it("only selects the commit for a folder", async () => {
    const user = userEvent.setup();
    renderList(true);
    await user.click(await screen.findByRole("option", { name: /^Tidy up/ }));
    expect(useSelectionStore.getState().selections["/repo"]).toEqual({ kind: "commit", row: 3 });
    expect(useSelectionStore.getState().files["/repo"]).toBeUndefined();
    expect(useTabsStore.getState().activeTabId).toBeNull();
  });

  it("moves the cursor to the commit selected elsewhere", async () => {
    renderList();
    await screen.findByRole("option", { name: /^Tidy up/ });
    useSelectionStore.getState().select("/repo", { kind: "commit", row: 9 });
    expect(await screen.findByRole("option", { name: /^Move into src/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
