import { nextRow } from "./navigation";

describe("nextRow", () => {
  it.each([
    ["ArrowDown", 5, 6],
    ["ArrowUp", 5, 4],
    ["PageDown", 5, 14],
    ["PageUp", 15, 6],
    ["Home", 50, 0],
    ["End", 5, 99],
  ])("%s from %i goes to %i", (key, current, expected) => {
    expect(nextRow(key, current, 100, 10)).toBe(expected);
  });

  it("clamps at both ends", () => {
    expect(nextRow("ArrowUp", 0, 100, 10)).toBe(0);
    expect(nextRow("PageDown", 98, 100, 10)).toBe(99);
  });

  it("starts at the top when nothing is selected", () => {
    expect(nextRow("ArrowDown", undefined, 100, 10)).toBe(0);
  });

  it("ignores other keys and empty graphs", () => {
    expect(nextRow("a", 1, 100, 10)).toBeNull();
    expect(nextRow("ArrowDown", 1, 0, 10)).toBeNull();
  });
});
