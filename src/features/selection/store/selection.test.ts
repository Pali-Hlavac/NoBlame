import { compare, compareWithParent, selectFile, select, useSelectionStore } from "./selection";

describe("selection store", () => {
  beforeEach(() => {
    useSelectionStore.setState({ selections: {}, files: {}, parents: {}, comparisons: {} });
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

  it("keeps the comparison when another commit is selected", () => {
    const comparison = { base: "main", target: "feature", sinceMergeBase: false };
    compare("/r", comparison);
    select("/r", { kind: "commit", row: 3 });
    expect(useSelectionStore.getState().comparisons["/r"]).toEqual(comparison);
  });

  it("forgets everything about a closed repository", () => {
    select("/r", { kind: "commit", row: 1 });
    selectFile("/r", "a.txt");
    compare("/r", { base: "HEAD", target: "v1", sinceMergeBase: true });
    useSelectionStore.getState().clear("/r");
    const state = useSelectionStore.getState();
    expect(state.selections["/r"]).toBeUndefined();
    expect(state.files["/r"]).toBeUndefined();
    expect(state.comparisons["/r"]).toBeUndefined();
  });

  it("forgets a comparison even with nothing selected", () => {
    compare("/r", { base: "HEAD", target: "v1", sinceMergeBase: false });
    useSelectionStore.getState().clear("/r");
    expect(useSelectionStore.getState().comparisons["/r"]).toBeUndefined();
  });
});
