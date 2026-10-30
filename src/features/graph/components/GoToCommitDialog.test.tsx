import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { useSelectionStore } from "@/features/selection";

import { openGoTo } from "../api/find";
import { useGraphViewStore } from "../store/graphView";
import { GoToCommitDialog } from "./GoToCommitDialog";

const ipc = vi.hoisted(() => ({ goToCommit: vi.fn() }));

vi.mock("@/shared/ipc/bindings", () => ({ commands: { goToCommit: ipc.goToCommit } }));

const ID = "0123456789abcdef0123456789abcdef01234567";

function renderDialog() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  render(<GoToCommitDialog repoId={1} repoPath="/repo" />, { wrapper });
}

beforeEach(() => {
  useSelectionStore.getState().clear("/repo");
  useGraphViewStore.getState().setGoToOpen(null);
});

describe("GoToCommitDialog", () => {
  it("selects the commit a revision names and closes", async () => {
    ipc.goToCommit.mockResolvedValue({ status: "ok", data: { id: ID, row: 12, status: "shown" } });
    renderDialog();
    openGoTo("/repo");
    await userEvent.type(await screen.findByRole("textbox"), "HEAD~2{Enter}");
    await waitFor(() => {
      expect(useSelectionStore.getState().selections["/repo"]).toEqual({ kind: "commit", row: 12 });
    });
    expect(ipc.goToCommit).toHaveBeenCalledWith(1, "HEAD~2");
    expect(useGraphViewStore.getState().goToOpen).toBeNull();
  });

  it("explains a commit hidden by the filter and an unknown name", async () => {
    ipc.goToCommit.mockResolvedValueOnce({
      status: "ok",
      data: { id: ID, row: null, status: "hiddenByFilter" },
    });
    renderDialog();
    openGoTo("/repo");
    await userEvent.type(await screen.findByRole("textbox"), "abc1{Enter}");
    expect(await screen.findByText("The filter hides commit 01234567.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show all commits and go there" })).toBeEnabled();

    ipc.goToCommit.mockResolvedValueOnce({
      status: "error",
      error: { code: "NOT_FOUND", message: 'No commit is called "nope".', hint: null },
    });
    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "nope{Enter}");
    expect(await screen.findByText('No commit is called "nope".')).toBeInTheDocument();
  });
});
