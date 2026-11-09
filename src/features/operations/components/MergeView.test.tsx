import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import type { MergeFileDto } from "@/shared/ipc/bindings";

import { joinTexts, mergedText } from "../lib/mergeView";
import { showMergeView, useMergeViewStore } from "../store/mergeView";
import { MergeView } from "./MergeView";

const ipc = vi.hoisted(() => ({
  getMergeFile: vi.fn(),
  saveMergedFile: vi.fn(),
  getStatus: vi.fn(),
  getConflicts: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/repositories", () => ({
  useActiveRepository: () => ({ summary: { id: 1, head: { kind: "branch", name: "main" } } }),
  WithActiveRepository: ({
    children,
  }: {
    children: (summary: { id: number }, tab: { path: string }) => ReactNode;
  }) => children({ id: 1 }, { path: "/repo" }),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok" as const, data });
}

const MERGED: MergeFileDto = {
  kind: "text",
  crlf: false,
  chunks: [
    { kind: "resolved", source: "unchanged", text: "a\n" },
    { kind: "conflict", base: "b\n", ours: "ours\n", theirs: "theirs\n" },
    { kind: "resolved", source: "ours", text: "c\n" },
    { kind: "conflict", base: "d\n", ours: "x\n", theirs: "y\n" },
  ],
};

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MergeView />
    </QueryClientProvider>,
  );
}

describe("the merge view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMergeViewStore.setState({ shown: {}, decisions: {} });
    ipc.getStatus.mockReturnValue(
      ok({
        summary: {
          staged: 0,
          unstaged: 1,
          untracked: 0,
          conflicted: 1,
          changes: { added: 0, changed: 1, deleted: 0 },
        },
        staged: [],
        unstaged: [],
        operation: { kind: "merge", detail: "Merge branch 'topic'", step: null, steps: null },
      }),
    );
    ipc.getConflicts.mockReturnValue(ok([]));
    ipc.saveMergedFile.mockReturnValue(ok(null));
  });

  it("decides each conflict and saves the merged file", async () => {
    const user = userEvent.setup();
    ipc.getMergeFile.mockReturnValue(ok(MERGED));
    showMergeView(1, "src/file.txt");
    renderView();

    expect(await screen.findByText("0 of 2 conflicts decided")).toBeVisible();
    expect(screen.getAllByText("Ours: main")).not.toHaveLength(0);
    const save = screen.getByRole("button", { name: "Save and mark resolved" });
    expect(save).toBeDisabled();

    const first = screen.getByRole("region", { name: "Conflict 1 of 2" });
    expect(within(first).getByText("Theirs: topic")).toBeVisible();
    await user.click(within(first).getByRole("button", { name: "Use theirs" }));
    expect(within(first).getByText("Decided: theirs")).toBeVisible();

    const second = screen.getByRole("region", { name: "Conflict 2 of 2" });
    await user.click(within(second).getByRole("button", { name: "Edit…" }));
    const editor = within(second).getByRole("textbox");
    expect(editor).toHaveValue("x\ny\n");
    await user.clear(editor);
    await user.type(editor, "mine");
    await user.click(within(second).getByRole("button", { name: "Done" }));

    expect(screen.getByText("2 of 2 conflicts decided")).toBeVisible();
    await user.click(save);
    expect(ipc.saveMergedFile).toHaveBeenCalledWith(1, {
      path: "src/file.txt",
      text: "a\ntheirs\nc\nmine",
      crlf: false,
    });
  });

  it("takes one side for the conflicts left", async () => {
    const user = userEvent.setup();
    ipc.getMergeFile.mockReturnValue(ok(MERGED));
    showMergeView(1, "src/file.txt");
    renderView();
    await user.click(await screen.findByRole("button", { name: "Use ours for the rest" }));
    await user.click(screen.getByRole("button", { name: "Save and mark resolved" }));
    expect(ipc.saveMergedFile).toHaveBeenCalledWith(1, {
      path: "src/file.txt",
      text: "a\nours\nc\nx\n",
      crlf: false,
    });
  });

  it("says why a file cannot be merged here", async () => {
    ipc.getMergeFile.mockReturnValue(ok({ kind: "unavailable", reason: "binary" }));
    showMergeView(1, "logo.png");
    renderView();
    expect(await screen.findByText("logo.png cannot be merged here")).toBeVisible();
    expect(screen.getByText(/This file is binary/)).toBeVisible();
  });
});

describe("putting the merged file together", () => {
  it("starts every text on a line of its own", () => {
    expect(joinTexts(["a", "b\n", "", "c"])).toBe("a\nb\nc");
  });

  it("waits until every conflict is decided", () => {
    expect(mergedText([{ kind: "conflict", base: "", ours: "a", theirs: "b" }], {})).toBeNull();
  });
});
