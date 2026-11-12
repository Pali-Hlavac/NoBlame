import { useSelectionStore } from "@/features/selection";
import type { RepoSummary } from "@/shared/ipc/bindings";

import { chooseScopedFile } from "./choose";

const ipc = vi.hoisted(() => ({ getStatus: vi.fn() }));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const summary = { id: 3, name: "app", path: "/work/app" } as RepoSummary;

function entry(path: string) {
  return { path, previousPath: null, status: "modified", oldId: null, newId: null };
}

describe("chooseScopedFile", () => {
  beforeEach(() => {
    useSelectionStore.setState({ selections: {}, files: {} });
    ipc.getStatus.mockResolvedValue({
      status: "ok",
      data: { staged: [entry("only-staged.ts"), entry("both.ts")], unstaged: [entry("both.ts")] },
    });
  });

  it("selects the working tree changes of a folder, without choosing a file", async () => {
    await chooseScopedFile({
      path: "/work/app/src",
      summary,
      scope: { relative: "src", isFolder: true },
    });
    expect(useSelectionStore.getState().selections["/work/app/src"]).toEqual({ kind: "worktree" });
    expect(useSelectionStore.getState().files["/work/app/src"]).toBeUndefined();
    expect(ipc.getStatus).not.toHaveBeenCalled();
  });

  it("chooses a file's unstaged changes, or its staged ones when it has only those", async () => {
    const both = "/work/app/both.ts";
    await chooseScopedFile({
      path: both,
      summary,
      scope: { relative: "both.ts", isFolder: false },
    });
    expect(useSelectionStore.getState().selections[both]).toEqual({ kind: "worktree" });
    expect(useSelectionStore.getState().files[both]).toBe("both.ts");

    const staged = "/work/app/only-staged.ts";
    await chooseScopedFile({
      path: staged,
      summary,
      scope: { relative: "only-staged.ts", isFolder: false },
    });
    expect(useSelectionStore.getState().selections[staged]).toEqual({ kind: "index" });
  });
});
