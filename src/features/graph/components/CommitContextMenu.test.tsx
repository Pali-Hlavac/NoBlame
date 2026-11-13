import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CommitRowDto } from "@/shared/ipc/bindings";

import { CommitContextMenu } from "./CommitContextMenu";

const COMMIT: CommitRowDto = {
  row: 3,
  id: "0123456789abcdef0123456789abcdef01234567",
  summary: "Fix the parser",
  body: "",
  authorName: "Ada",
  authorEmail: "ada@example.com",
  authorTime: 0,
  parentCount: 1,
  refs: [],
  stashes: [],
};

function renderMenu(commit: CommitRowDto | undefined, onToggleHighlight = vi.fn()) {
  render(
    <CommitContextMenu
      repoId={1}
      repoPath="/repo"
      row={commit ? 3 : undefined}
      commit={commit}
      hasWorkingTree
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

  it("shows a branch icon before branches and a globe before remote branches", async () => {
    renderMenu({
      ...COMMIT,
      refs: [
        { kind: "branch", name: "main", isHead: false },
        { kind: "remote", name: "origin/main", isHead: false },
      ],
    });
    fireEvent.contextMenu(screen.getByTestId("list"));
    const branch = await screen.findByRole("menuitem", { name: "Branch main" });
    const remote = screen.getByRole("menuitem", { name: "Remote branch origin/main" });
    expect(branch.querySelector("svg.lucide-git-branch")).toHaveClass("text-kind-branches");
    expect(remote.querySelector("svg.lucide-globe")).toHaveClass("text-kind-branches");
    // Entries without an icon keep its room, so the labels line up.
    const more = screen.getByRole("menuitem", { name: "More" });
    expect(more.firstElementChild).toHaveClass("size-4");
  });

  it("has no menu without a selected commit", () => {
    renderMenu(undefined);
    fireEvent.contextMenu(screen.getByTestId("list"));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
