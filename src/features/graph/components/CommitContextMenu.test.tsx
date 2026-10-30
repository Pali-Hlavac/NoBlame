import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CommitRowDto } from "@/shared/ipc/bindings";

import { CommitContextMenu } from "./CommitContextMenu";

const COMMIT: CommitRowDto = {
  row: 3,
  id: "0123456789abcdef0123456789abcdef01234567",
  summary: "Fix the parser",
  authorName: "Ada",
  authorEmail: "ada@example.com",
  authorTime: 0,
  parentCount: 1,
  refs: [],
};

function renderMenu(commit: CommitRowDto | undefined, onToggleHighlight = vi.fn()) {
  render(
    <CommitContextMenu
      repoId={1}
      row={commit ? 3 : undefined}
      commit={commit}
      highlighted={false}
      onToggleHighlight={onToggleHighlight}
    >
      <div data-testid="list">commits</div>
    </CommitContextMenu>,
  );
  return onToggleHighlight;
}

describe("CommitContextMenu", () => {
  it("opens on right click with working and planned entries", async () => {
    const toggle = renderMenu(COMMIT);
    fireEvent.contextMenu(screen.getByTestId("list"));
    expect(await screen.findByRole("menu", { name: /Actions for commit 01234567/ })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: /Create a branch here.*M5/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Highlight its history" }));
    expect(toggle).toHaveBeenCalled();
  });

  it("has no menu without a selected commit", () => {
    renderMenu(undefined);
    fireEvent.contextMenu(screen.getByTestId("list"));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
