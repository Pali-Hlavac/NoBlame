import { repositoryName, repositoryTab } from "./path";

describe("repositoryName", () => {
  it.each([
    ["/home/ada/src/linux", "linux"],
    ["C:\\src\\app\\", "app"],
    ["C:/mixed\\sep/repo", "repo"],
    ["/", "/"],
    ["relative", "relative"],
  ])("%s → %s", (path, expected) => {
    expect(repositoryName(path)).toBe(expected);
  });
});

describe("repositoryTab", () => {
  it("ignores trailing separators in the identity", () => {
    expect(repositoryTab("/r/x/").id).toBe(repositoryTab("/r/x").id);
  });

  it("keeps the original path for the backend", () => {
    expect(repositoryTab("/r/x/")).toMatchObject({ kind: "repository", path: "/r/x/", title: "x" });
  });
});
