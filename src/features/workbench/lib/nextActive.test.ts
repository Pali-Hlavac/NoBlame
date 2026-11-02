import { nextActiveAfterClose, type GroupLike } from "./nextActive";

const group = (ids: string[], active?: string): GroupLike => ({
  panels: ids.map((id) => ({ id })),
  activePanel: active === undefined ? undefined : { id: active },
});

describe("nextActiveAfterClose", () => {
  it("keeps what the dock focused instead", () => {
    const dock = { activePanel: { id: "b" }, groups: [group(["a", "b"], "b")] };
    expect(nextActiveAfterClose(dock, "a", null)).toBe("b");
  });

  it("never picks a tab hidden in the other half of a split", () => {
    // Left: two repositories, r2 shown. Right: the diff, which closes and leaves no group.
    const dock = { activePanel: undefined, groups: [group(["r1", "r2"], "r2")] };
    expect(nextActiveAfterClose(dock, "diff", "r2")).toBe("r2");
    expect(nextActiveAfterClose(dock, "diff", "r1")).toBe("r2");
  });

  it("ignores the closed tab when the dock still reports it as focused", () => {
    const dock = {
      activePanel: { id: "diff" },
      groups: [group(["r1", "r2"], "r1"), group(["diff"], "diff")],
    };
    expect(nextActiveAfterClose(dock, "diff", "r1")).toBe("r1");
  });

  it("prefers the closed tab's neighbour in its own group", () => {
    const dock = {
      activePanel: { id: "diff" },
      groups: [group(["r1"], "r1"), group(["diff", "file"], "diff")],
    };
    expect(nextActiveAfterClose(dock, "diff", "r1")).toBe("file");
  });

  it("returns null when nothing is left", () => {
    expect(nextActiveAfterClose({ activePanel: undefined, groups: [] }, "a", null)).toBeNull();
  });
});
