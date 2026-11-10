import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { PlannedCommitDto } from "@/shared/ipc/bindings";

import { type TodoRow, autosquash, buildSteps, problem } from "../lib/todo";
import { openInteractive } from "../store/dialog";
import { OperationDialogs } from "./OperationDialogs";

const ipc = vi.hoisted(() => ({
  getInteractivePlan: vi.fn(),
  rebaseInteractive: vi.fn(),
  getStatus: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/repositories", () => ({
  useActiveRepository: () => ({ summary: { id: 1, head: { kind: "branch", name: "topic" } } }),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }),
}));

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok" as const, data });
}

function commit(letter: string, message: string): PlannedCommitDto {
  return { id: letter.repeat(40), author: "Ada", time: 0, message };
}

const A = commit("a", "add a");
const B = commit("b", "change b");
const FIX = commit("f", "fixup! add a");
const SQUASH = commit("e", "squash! add");

const rows = (...commits: [PlannedCommitDto, TodoRow["action"]][]): TodoRow[] =>
  commits.map(([c, action]) => ({ commit: c, action }));

describe("the todo list", () => {
  it("arranges fixup! and squash! commits under the commit they name", () => {
    const arranged = autosquash(rows([A, "pick"], [B, "pick"], [FIX, "pick"], [SQUASH, "pick"]));
    expect(arranged.map((row) => [row.commit.message, row.action])).toEqual([
      ["add a", "pick"],
      ["fixup! add a", "fixup"],
      ["squash! add", "squash"],
      ["change b", "pick"],
    ]);
  });

  it("gives a group with squashes the combined message, unless one was typed", () => {
    const list = rows([A, "pick"], [B, "squash"], [FIX, "reword"]);
    expect(buildSteps(list, {}).map((step) => step.message)).toEqual([
      "add a\n\nchange b",
      null,
      "fixup! add a",
    ]);
    // A squash! commit's subject is left out of the combined message; its body is kept.
    const squashed = { ...SQUASH, message: "squash! add\n\nWhy it changed" };
    expect(buildSteps(rows([A, "pick"], [squashed, "squash"]), {})[0]?.message).toBe(
      "add a\n\nWhy it changed",
    );
    // A message typed for a commit that is no longer reworded is not used.
    expect(buildSteps(rows([A, "pick"]), { [A.id]: "typed" })[0]?.message).toBeNull();
  });

  it("says what git could not do", () => {
    expect(problem(rows([A, "fixup"]))).toMatch(/cannot be squashed/);
    expect(problem(rows([A, "drop"], [B, "drop"]))).toMatch(/Reset/);
    expect(problem(rows([A, "pick"], [B, "squash"]))).toBeNull();
  });
});

describe("the interactive rebase editor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.getStatus.mockReturnValue(
      ok({
        summary: {
          staged: 0,
          unstaged: 0,
          untracked: 0,
          conflicted: 0,
          changes: { added: 0, changed: 0, deleted: 0 },
        },
        staged: [],
        unstaged: [],
        operation: null,
      }),
    );
    ipc.getInteractivePlan.mockReturnValue(ok({ commits: [A, B, FIX], merges: 0, published: 1 }));
    ipc.rebaseInteractive.mockReturnValue(ok({ outcome: "rebased", detail: null }));
  });

  it("edits the list and rebases with it", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <OperationDialogs />
      </QueryClientProvider>,
    );
    openInteractive(1, { revision: A.id, label: "aaaaaaaa add a" });

    expect(await screen.findByText(/1 of these commits were pushed already/)).toBeVisible();
    const rebase = screen.getByRole("button", { name: "Rebase" });
    expect(rebase).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Arrange fixup! commits" }));
    expect(screen.getByRole("combobox", { name: "What to do with fixup! add a" })).toHaveValue(
      "fixup",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "What to do with change b" }),
      "reword",
    );
    const message = screen.getByRole("textbox", { name: "New message for change b" });
    await user.type(message, " (better)");
    await user.click(screen.getByRole("button", { name: "Move change b up" }));
    await user.click(rebase);

    expect(ipc.rebaseInteractive).toHaveBeenCalledWith(1, {
      from: A.id,
      autostash: false,
      steps: [
        { action: "pick", commit: A.id, message: null },
        { action: "reword", commit: B.id, message: "change b (better)" },
        { action: "fixup", commit: FIX.id, message: null },
      ],
    });
  });
});
