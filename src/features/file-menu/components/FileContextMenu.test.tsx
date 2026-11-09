import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { fullPath } from "../lib/paths";
import { FileContextMenu } from "./FileContextMenu";

const ipc = vi.hoisted(() => ({
  openWorktreeFile: vi.fn(() => Promise.resolve({ status: "ok", data: null })),
  showWorktreeFile: vi.fn(() => Promise.resolve({ status: "ok", data: null })),
  saveFileAs: vi.fn(() => Promise.resolve({ status: "ok", data: null })),
}));
const history = vi.hoisted(() => ({ showHistory: vi.fn() }));
const blame = vi.hoisted(() => ({ showBlame: vi.fn() }));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/history", () => history);
vi.mock("@/features/blame", () => blame);

function renderMenu(file: Parameters<typeof FileContextMenu>[0]["file"]) {
  const showDiff = vi.fn();
  render(
    <FileContextMenu
      repoId={3}
      repoPath="C:\code\app"
      file={file}
      actions={[{ label: "Show diff", onSelect: showDiff }]}
    >
      <div data-testid="list">files</div>
    </FileContextMenu>,
  );
  fireEvent.contextMenu(screen.getByTestId("list"));
  return showDiff;
}

describe("the file menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers the list's actions, then opening, saving, copying and history", async () => {
    const user = userEvent.setup();
    const showDiff = renderMenu({ path: "src/main.ts", blobId: "abc", commit: "c0ffee" });
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual([
      "Show diff",
      "Open working tree file",
      expect.stringMatching(/^Show in /),
      "Save this version as…",
      "Copy path",
      "Copy full path",
      "Copy name",
      "File history",
      "Blame",
    ]);
    await user.click(screen.getByRole("menuitem", { name: "Show diff" }));
    expect(showDiff).toHaveBeenCalled();
  });

  it("opens the file on disk and blames it at the commit listed", async () => {
    const user = userEvent.setup();
    renderMenu({ path: "src/main.ts", commit: "c0ffee" });
    await user.click(screen.getByRole("menuitem", { name: "Open working tree file" }));
    expect(ipc.openWorktreeFile).toHaveBeenCalledWith(3, "src/main.ts");

    fireEvent.contextMenu(screen.getByTestId("list"));
    await user.click(screen.getByRole("menuitem", { name: "Blame" }));
    expect(blame.showBlame).toHaveBeenCalledWith("C:\\code\\app", {
      commit: "c0ffee",
      path: "src/main.ts",
    });
  });

  it("has no Save or Blame for a working tree file", () => {
    renderMenu({ path: "notes.txt" });
    expect(screen.queryByRole("menuitem", { name: /Save/ })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Blame" })).toBeNull();
  });

  it("joins full paths with the repository's separator", () => {
    expect(fullPath("C:\\code\\app\\", "src/main.ts")).toBe("C:\\code\\app\\src\\main.ts");
    expect(fullPath("/home/me/app", "src/main.ts")).toBe("/home/me/app/src/main.ts");
  });
});
