import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

import type { BisectStateDto, OperationDto } from "@/shared/ipc/bindings";

import { bisectLine, bisectToast, marksLine } from "../lib/bisect";
import { openBisect } from "../store/dialog";
import { OperationBanner } from "./OperationBanner";
import { OperationDialogs } from "./OperationDialogs";

const ipc = vi.hoisted(() => ({
  bisectMark: vi.fn(),
  getBisect: vi.fn(),
  stepOperation: vi.fn(),
  getStatus: vi.fn(),
  goToCommit: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/repositories", () => ({
  useActiveRepository: () => ({
    tab: { path: "/repo" },
    summary: { id: 1, head: { kind: "branch", name: "main" } },
  }),
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

function status(operation: OperationDto | null, unstaged = 0) {
  return {
    summary: {
      staged: 0,
      unstaged,
      untracked: 0,
      conflicted: 0,
      changes: { added: 0, changed: unstaged, deleted: 0 },
    },
    staged: [],
    unstaged: [],
    operation,
  };
}

const BISECT: OperationDto = { kind: "bisect", detail: null, step: null, steps: null };

const TESTING: BisectStateDto = {
  bad: "b".repeat(40),
  good: ["a".repeat(40)],
  skipped: [],
  testing: { id: "c".repeat(40), summary: "Parse dates" },
  firstBad: null,
  startedFrom: "main",
};

function renderWith(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("bisect words", () => {
  it("say what comes next", () => {
    expect(bisectLine(TESTING, { commit: "c".repeat(40), remaining: 4, steps: 2 })).toBe(
      "Testing cccccccc Parse dates: 4 commits left after it (about 2 more steps)",
    );
    // Counts from a mark that checked out another commit (a terminal moved on) are not shown.
    expect(bisectLine(TESTING, { commit: "d".repeat(40), remaining: 4, steps: 2 })).toBe(
      "Testing cccccccc Parse dates",
    );
    expect(bisectLine({ ...TESTING, good: [] })).toMatch(/now mark a good commit/);
    expect(marksLine({ ...TESTING, skipped: ["d".repeat(40)] })).toBe("1 bad, 1 good, 1 skipped");
    expect(bisectToast("bad", { kind: "waiting" }).description).toMatch(/mark a good commit/);
    expect(bisectToast("good", { kind: "found", commit: "e".repeat(40) }).title).toBe(
      "Found the first bad commit: eeeeeeee",
    );
  });
});

describe("bisecting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("explains bisecting before the first mark starts it", async () => {
    const user = userEvent.setup();
    ipc.getStatus.mockReturnValue(ok(status(null, 2)));
    ipc.bisectMark.mockReturnValue(ok({ outcome: { kind: "waiting" }, detail: "" }));
    renderWith(<OperationDialogs />);
    openBisect(1, { revision: "f".repeat(40), label: "ffffffff Break it" }, "bad");
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("This marks ffffffff Break it as bad");
    expect(dialog).toHaveTextContent("goes back to main");
    await waitFor(() => {
      expect(dialog).toHaveTextContent("You have uncommitted changes");
    });
    await user.click(within(dialog).getByRole("button", { name: "Start bisecting" }));
    expect(ipc.bisectMark).toHaveBeenCalledWith(1, "bad", "f".repeat(40));
    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith("Marked as bad", expect.anything());
    });
  });

  it("marks the commit being tested from the bar", async () => {
    const user = userEvent.setup();
    ipc.getStatus.mockReturnValue(ok(status(BISECT)));
    ipc.getBisect.mockReturnValue(ok(TESTING));
    ipc.bisectMark.mockReturnValue(
      ok({
        outcome: { kind: "testing", commit: "d".repeat(40), remaining: 1, steps: 1 },
        detail: "",
      }),
    );
    renderWith(<OperationBanner repoId={1} />);
    expect(await screen.findByText(/Testing cccccccc Parse dates/)).toBeVisible();
    expect(screen.getByText("Marked: 1 bad, 1 good")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Bad" }));
    expect(ipc.bisectMark).toHaveBeenCalledWith(1, "bad", null);
  });

  it("names the first bad commit and stops without asking", async () => {
    const user = userEvent.setup();
    const found = { ...TESTING, testing: null, firstBad: { id: "e".repeat(40), summary: "Oops" } };
    ipc.getStatus.mockReturnValue(ok(status(BISECT)));
    ipc.getBisect.mockReturnValue(ok(found));
    ipc.stepOperation.mockReturnValue(ok("finished"));
    renderWith(<OperationBanner repoId={1} />);
    expect(await screen.findByText("Found the first bad commit: eeeeeeee Oops")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Good" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Stop bisecting" }));
    expect(ipc.stepOperation).toHaveBeenCalledWith(1, "abort");
  });
});
