import { compareWithParent, selectFile, select, useSelectionStore } from "./selection";

describe("selection store", () => {
  beforeEach(() => {
    useSelectionStore.setState({ selections: {}, files: {}, parents: {} });
  });

  it("keeps the chosen file when another commit is selected", () => {
    select("/r", { kind: "commit", row: 1 });
    selectFile("/r", "a.txt");
    select("/r", { kind: "commit", row: 2 });
    expect(useSelectionStore.getState().files["/r"]).toBe("a.txt");
  });

  it("compares the next commit with its first parent again", () => {
    select("/r", { kind: "commit", row: 1 });
    compareWithParent("/r", 1);
    select("/r", { kind: "commit", row: 1 });
    expect(useSelectionStore.getState().parents["/r"]).toBe(1);
    select("/r", { kind: "commit", row: 2 });
    expect(useSelectionStore.getState().parents["/r"]).toBeUndefined();
  });

  it("keeps repositories apart", () => {
    selectFile("/a", "a.txt");
    select("/b", { kind: "worktree" });
    expect(useSelectionStore.getState().files["/a"]).toBe("a.txt");
  });

  it("forgets everything about a closed repository", () => {
    select("/r", { kind: "commit", row: 1 });
    selectFile("/r", "a.txt");
    useSelectionStore.getState().clear("/r");
    const state = useSelectionStore.getState();
    expect(state.selections["/r"]).toBeUndefined();
    expect(state.files["/r"]).toBeUndefined();
  });
});
