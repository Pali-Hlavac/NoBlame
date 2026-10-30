import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useSelectionStore } from "@/features/selection";

import { openFind } from "../api/find";
import { useGraphViewStore } from "../store/graphView";
import { FindBar } from "./FindBar";

const ipc = vi.hoisted(() => ({ findCommit: vi.fn() }));

vi.mock("@/shared/ipc/bindings", () => ({ commands: { findCommit: ipc.findCommit } }));

const ROWS = [2, 7, 30];

beforeEach(() => {
  useSelectionStore.getState().clear("/repo");
  useGraphViewStore.getState().setFindOpen("/repo", false);
  ipc.findCommit.mockReset();
  ipc.findCommit.mockImplementation(
    (_id: number, _query: string, from: number | null, backwards: boolean) => {
      const index = backwards
        ? from === null
          ? ROWS.length - 1
          : ROWS.findLastIndex((row) => row < from)
        : from === null
          ? 0
          : ROWS.findIndex((row) => row > from);
      const position = index < 0 ? (backwards ? ROWS.length - 1 : 0) : index;
      return Promise.resolve({
        status: "ok",
        data: { row: ROWS[position], position: position + 1, total: ROWS.length },
      });
    },
  );
});

describe("FindBar", () => {
  it("is hidden until opened, then finds as you type and steps with Enter", async () => {
    render(<FindBar repoId={1} repoPath="/repo" />);
    expect(screen.queryByRole("search")).toBeNull();
    openFind("/repo");
    const input = await screen.findByRole("searchbox");
    await userEvent.type(input, "fix");
    await waitFor(() => {
      expect(screen.getByText("1 of 3")).toBeInTheDocument();
    });
    expect(useSelectionStore.getState().selections["/repo"]).toEqual({ kind: "commit", row: 2 });

    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("2 of 3")).toBeInTheDocument();
    });
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    await waitFor(() => {
      expect(screen.getByText("1 of 3")).toBeInTheDocument();
    });

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("search")).toBeNull();
  });
});
