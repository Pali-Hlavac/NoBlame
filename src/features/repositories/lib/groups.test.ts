import type { RepositoryGroup } from "@/shared/ipc/bindings";

import {
  addGroup,
  freeGroupName,
  groupDropIndex,
  groupHas,
  moveGroup,
  placeRepository,
  removeGroup,
  removeRepository,
  renameGroup,
  repositoryDropIndex,
  setCollapsed,
} from "./groups";

const group = (id: string, repositories: string[] = []): RepositoryGroup => ({
  id,
  name: id,
  collapsed: false,
  repositories,
});

const ids = (groups: readonly RepositoryGroup[]) => groups.map((each) => each.id);

describe("repository groups", () => {
  it("names new groups without repeating a name", () => {
    expect(freeGroupName([])).toBe("New group");
    const named = (name: string) => ({ ...group(name), name });
    expect(freeGroupName([named("New group"), named("New group 2")])).toBe("New group 3");
  });

  it("adds, renames, folds and removes groups without touching the input", () => {
    const start = [group("a")];
    const added = addGroup(start, "b", "Work", ["/r/one"]);
    expect(ids(start)).toEqual(["a"]);
    expect(added[1]).toEqual({ id: "b", name: "Work", collapsed: false, repositories: ["/r/one"] });
    expect(renameGroup(added, "b", "Play")[1]?.name).toBe("Play");
    expect(setCollapsed(added, "a", true)[0]?.collapsed).toBe(true);
    expect(ids(removeGroup(added, "a"))).toEqual(["b"]);
  });

  it("moves a group to an index of the resulting list", () => {
    const groups = [group("a"), group("b"), group("c")];
    expect(ids(moveGroup(groups, "a", 2))).toEqual(["b", "c", "a"]);
    expect(ids(moveGroup(groups, "c", 0))).toEqual(["c", "a", "b"]);
    expect(ids(moveGroup(groups, "b", 99))).toEqual(["a", "c", "b"]);
  });

  it("places a repository once, at an index or the end", () => {
    const groups = [group("a", ["/r/one", "/r/two"])];
    expect(placeRepository(groups, "/r/three", "a")[0]?.repositories).toEqual([
      "/r/one",
      "/r/two",
      "/r/three",
    ]);
    expect(placeRepository(groups, "/r/three", "a", 0)[0]?.repositories[0]).toBe("/r/three");
    // Already there (a trailing slash names the same folder): moved, not repeated.
    expect(placeRepository(groups, "/r/one/", "a")[0]?.repositories).toEqual(["/r/two", "/r/one/"]);
  });

  it("moves a repository between groups", () => {
    const groups = [group("a", ["/r/one"]), group("b", ["/r/two"])];
    const moved = placeRepository(groups, "/r/one", "b", 0, "a");
    expect(moved[0]?.repositories).toEqual([]);
    expect(moved[1]?.repositories).toEqual(["/r/one", "/r/two"]);
    expect(groupHas(moved[1] ?? group("x"), "/r/one")).toBe(true);
    expect(removeRepository(moved, "b", "/r/two")[1]?.repositories).toEqual(["/r/one"]);
  });

  it("drops before a row, or after it on its lower half", () => {
    const work = group("a", ["/r/one", "/r/two", "/r/three"]);
    // Dragging the first row onto the lower half of the last one puts it last.
    const last = repositoryDropIndex(work, "/r/three", "/r/one", true);
    expect(placeRepository([work], "/r/one", "a", last, "a")[0]?.repositories).toEqual([
      "/r/two",
      "/r/three",
      "/r/one",
    ]);
    expect(repositoryDropIndex(work, "/r/two", "/r/new", false)).toBe(1);

    const groups = [group("a"), group("b"), group("c")];
    expect(ids(moveGroup(groups, "a", groupDropIndex(groups, "b", "a", true)))).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(ids(moveGroup(groups, "c", groupDropIndex(groups, "a", "c", false)))).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
});
