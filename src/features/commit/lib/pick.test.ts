import type { RowGesture } from "@/shared/components/VirtualList";

import { NOTHING_PICKED, pick, pickAll, pickedPaths, togglePick, type Picked } from "./pick";

const PATHS = ["a", "b", "c", "d", "e"];

function gesture(overrides: Partial<RowGesture> = {}): RowGesture {
  return { ctrl: false, shift: false, via: "pointer", secondary: false, ...overrides };
}

/** Presses rows in turn, as the list does: the choice so far, then the new one. */
function press(...steps: [number, Partial<RowGesture>?][]): Picked {
  let picked = NOTHING_PICKED;
  for (const [index, overrides] of steps) {
    const chosen = pickedPaths(picked, PATHS, picked.cursor ?? PATHS[index]);
    picked = pick(picked, chosen, PATHS, index, gesture(overrides));
  }
  return picked;
}

const sorted = (picked: Picked) => [...picked.paths].sort();

describe("pick", () => {
  it("chooses one file with a click", () => {
    expect(sorted(press([1], [3]))).toEqual(["d"]);
  });

  it("adds and removes files with Ctrl+click", () => {
    expect(sorted(press([0], [2, { ctrl: true }], [4, { ctrl: true }]))).toEqual(["a", "c", "e"]);
    expect(sorted(press([0], [2, { ctrl: true }], [0, { ctrl: true }]))).toEqual(["c"]);
  });

  it("chooses a range with Shift+click, from the last plain click", () => {
    expect(sorted(press([1], [3, { shift: true }]))).toEqual(["b", "c", "d"]);
    expect(sorted(press([3], [1, { shift: true }], [4, { shift: true }]))).toEqual(["d", "e"]);
  });

  it("adds a range with Ctrl+Shift+click", () => {
    const picked = press([0], [2, { ctrl: true }], [4, { ctrl: true, shift: true }]);
    expect(sorted(picked)).toEqual(["a", "c", "d", "e"]);
  });

  it("moves without choosing with Ctrl+arrows, and extends with Shift+arrows", () => {
    const moved = press([0], [1, { ctrl: true, via: "key" }]);
    expect(sorted(moved)).toEqual(["a"]);
    expect(moved.cursor).toBe("b");
    expect(sorted(press([0], [1, { shift: true, via: "key" }]))).toEqual(["a", "b"]);
  });

  it("keeps the choice for a right click on a chosen file", () => {
    const picked = press([0], [2, { shift: true }], [1, { secondary: true }]);
    expect(sorted(picked)).toEqual(["a", "b", "c"]);
    expect(sorted(press([0], [2, { shift: true }], [4, { secondary: true }]))).toEqual(["e"]);
  });

  it("holds only while the cursor stays where it put it", () => {
    const picked = press([0], [2, { shift: true }]);
    expect([...pickedPaths(picked, PATHS, "c")].sort()).toEqual(["a", "b", "c"]);
    expect([...pickedPaths(picked, PATHS, "e")]).toEqual(["e"]);
    expect(pickedPaths(picked, PATHS, undefined).size).toBe(0);
    expect([...pickedPaths(picked, ["b", "c"], "c")].sort()).toEqual(["b", "c"]);
  });

  it("toggles the cursor's file and chooses all", () => {
    expect([...togglePick(new Set(["a"]), "b").paths].sort()).toEqual(["a", "b"]);
    expect(pickAll(PATHS, "c").paths.size).toBe(5);
  });
});
