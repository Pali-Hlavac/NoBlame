import { nextActiveAfterClose, type GroupLike } from "./nextActive";

const group = (ids: string[], active?: string): GroupLike => ({
  panels: ids.map((id) => ({ id })),
  activePanel: active === undefined ? undefined : { id: active },
});

describe("nextActiveAfterClose", () => {
  it("shows the tab of the same group used last, not the neighbour", () => {
    const dock = { activePanel: { id: "b" }, groups: [group(["a", "b", "c", "d"], "b")] };
    expect(nextActiveAfterClose(dock, "b", ["b", "d", "a", "c"])).toBe("d");
  });

  it("chooses by the order of use when the dock has already taken the tab out", () => {
    // A group made by a layout change: the dock's own order of use starts over, ours does not.
    const home = group(["a", "c", "d"], "b");
    const dock = { activePanel: { id: "b" }, groups: [home] };
    expect(nextActiveAfterClose(dock, "b", ["b", "c", "a"], home)).toBe("c");
  });

  it("never picks a tab hidden in the other half of a split", () => {
    // Left: two repositories, r2 shown. Right: the diff, which closes and leaves no group.
    const dock = { activePanel: undefined, groups: [group(["r1", "r2"], "r2")] };
    expect(nextActiveAfterClose(dock, "diff", ["diff", "r1", "r2"])).toBe("r2");
  });

  it("takes the tab on screen used last when the group is left empty", () => {
    const dock = {
      activePanel: { id: "diff" },
      groups: [group(["r1"], "r1"), group(["file"], "file"), group(["diff"], "diff")],
    };
    expect(nextActiveAfterClose(dock, "diff", ["diff", "file", "r1"])).toBe("file");
  });

  it("falls back to the neighbour for tabs never used", () => {
    const dock = {
      activePanel: { id: "diff" },
      groups: [group(["r1"], "r1"), group(["diff", "file"], "diff")],
    };
    expect(nextActiveAfterClose(dock, "diff", [])).toBe("file");
  });

  it("returns null when nothing is left", () => {
    expect(nextActiveAfterClose({ activePanel: undefined, groups: [] }, "a", [])).toBeNull();
  });
});
