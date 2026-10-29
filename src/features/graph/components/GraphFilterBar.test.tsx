import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { useSelectionStore } from "@/features/selection";
import type { GraphFilterDto, GraphSummary, RefEntry } from "@/shared/ipc/bindings";

import { NO_FILTER } from "../api/filter";
import { GraphFilterBar } from "./GraphFilterBar";

const ipc = vi.hoisted(() => ({ setGraphFilter: vi.fn() }));

function ref(kind: RefEntry["label"]["kind"], name: string, isHead = false): RefEntry {
  return { label: { kind, name, isHead }, target: "0".repeat(40), row: 0 };
}

vi.mock("@/shared/ipc/bindings", () => ({
  commands: {
    listRefs: () =>
      Promise.resolve({
        status: "ok",
        data: [ref("branch", "main", true), ref("branch", "topic"), ref("tag", "v1.0")],
      }),
    setGraphFilter: ipc.setGraphFilter,
  },
}));

function summary(filter: GraphFilterDto, rows = 10): GraphSummary {
  return {
    rows,
    totalRows: 10,
    filter,
    maxLanes: 1,
    blockRows: 256,
    headRow: 0,
    missingParents: 0,
    buildMs: 1,
    generation: 1,
  };
}

function renderBar(filter: GraphFilterDto, rows?: number) {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<GraphFilterBar repoId={1} repoPath="/repo" summary={summary(filter, rows)} />, {
    wrapper,
  });
}

beforeEach(() => {
  useSelectionStore.getState().clear("/repo");
  ipc.setGraphFilter.mockClear();
  ipc.setGraphFilter.mockImplementation((_id: number, filter: GraphFilterDto) =>
    Promise.resolve({ status: "ok", data: { summary: summary(filter), row: null } }),
  );
});

describe("GraphFilterBar", () => {
  it("turns first parent on", async () => {
    renderBar(NO_FILTER);
    await userEvent.click(screen.getByRole("button", { name: "First parent" }));
    await waitFor(() => {
      expect(ipc.setGraphFilter).toHaveBeenCalledWith(1, { ...NO_FILTER, firstParent: true }, null);
    });
  });

  it("shows the history of a branch picked from the list", async () => {
    renderBar(NO_FILTER);
    await userEvent.click(
      screen.getByRole("button", { name: "Show the history of: All branches" }),
    );
    await userEvent.type(await screen.findByPlaceholderText("Find a branch or tag…"), "top");
    await userEvent.click(await screen.findByRole("option", { name: "topic" }));
    await waitFor(() => {
      expect(ipc.setGraphFilter).toHaveBeenCalledWith(
        1,
        { ...NO_FILTER, tips: { type: "refs", refs: [{ kind: "branch", name: "topic" }] } },
        null,
      );
    });
  });

  it("counts the shown commits and clears the filter", async () => {
    renderBar({ ...NO_FILTER, noMerges: true }, 3);
    expect(screen.getByText("3 of 10 commits")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No merges" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => {
      expect(ipc.setGraphFilter).toHaveBeenCalledWith(1, NO_FILTER, null);
    });
  });
});
