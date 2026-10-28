import { selectFile, select, useSelectionStore } from "./selection";

const file = { path: "a.txt", previousPath: null, oldId: "1", newId: "2" };

describe("selection store", () => {
  beforeEach(() => {
    useSelectionStore.setState({ selections: {}, files: {} });
  });

  it("forgets the chosen file when another commit is selected", () => {
    select("/r", { kind: "commit", row: 1 });
    selectFile("/r", file);
    select("/r", { kind: "commit", row: 1 });
    expect(useSelectionStore.getState().files["/r"]).toEqual(file);
    select("/r", { kind: "commit", row: 2 });
    expect(useSelectionStore.getState().files["/r"]).toBeUndefined();
  });

  it("keeps repositories apart", () => {
    selectFile("/a", file);
    select("/b", { kind: "worktree" });
    expect(useSelectionStore.getState().files["/a"]).toEqual(file);
  });
});
