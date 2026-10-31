import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useSelectionStore } from "@/features/selection";
import { useTabsStore } from "@/features/workspace";
import type { BlameDto } from "@/shared/ipc/bindings";

import { useBlameStore } from "../store/blame";
import { BlameCell } from "./BlameCell";

const ipc = vi.hoisted(() => ({ goToCommit: vi.fn() }));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const EDIT = "1111111111111111111111111111111111111111";
const PARENT = "2222222222222222222222222222222222222222";

const BLAME: BlameDto = {
  blobId: "3333333333333333333333333333333333333333",
  hunks: [{ line: 4, count: 2, commit: 0, originalLine: 7, path: 0 }],
  commits: [
    {
      id: EDIT,
      summary: "Rename and tidy",
      authorName: "Ada",
      authorEmail: "ada@example.com",
      authorTime: 1_600_000_000,
      previous: { id: PARENT, path: "old.rs" },
    },
  ],
  paths: ["new.rs"],
};

function renderCell(line = 4) {
  const hunk = BLAME.hunks[0];
  if (!hunk) throw new Error("fixture has a hunk");
  render(
    <BlameCell repoId={1} repoPath="/repo" blame={BLAME} hunk={hunk} line={line} recency={1} />,
  );
}

describe("BlameCell", () => {
  beforeEach(() => {
    useSelectionStore.setState({ selections: {}, files: {}, parents: {} });
    useTabsStore.setState({ tabs: [], activeTabId: null, activeRepositoryTabId: null });
    useBlameStore.setState({ targets: { "/repo": { commit: "c9", path: "new.rs" } }, back: {} });
    ipc.goToCommit.mockResolvedValue({
      status: "ok",
      data: { id: EDIT, row: 12, status: "shown" },
    });
  });

  it("selects the line's commit in the graph", async () => {
    const user = userEvent.setup();
    renderCell();
    await user.click(screen.getByRole("button", { name: /^Lines 4 to 5: 11111111 by Ada/ }));
    await waitFor(() => {
      expect(useSelectionStore.getState().selections["/repo"]).toEqual({ kind: "commit", row: 12 });
    });
    expect(ipc.goToCommit).toHaveBeenCalledWith(1, EDIT);
  });

  it("shows only the mark on the hunk's other lines", () => {
    renderCell(5);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the change, and blames the version before it", async () => {
    const user = userEvent.setup();
    renderCell();
    fireEvent.contextMenu(screen.getByRole("button"));
    await user.click(await screen.findByRole("menuitem", { name: "Show the change" }));
    await waitFor(() => {
      expect(useTabsStore.getState().activeTabId).toBe("diff");
    });
    expect(useSelectionStore.getState().files["/repo"]).toBe("new.rs");

    fireEvent.contextMenu(screen.getByRole("button"));
    await user.click(await screen.findByRole("menuitem", { name: "Blame the previous revision" }));
    expect(useBlameStore.getState().targets["/repo"]).toEqual({ commit: PARENT, path: "old.rs" });
    expect(useBlameStore.getState().back["/repo"]).toEqual([{ commit: "c9", path: "new.rs" }]);
  });
});
