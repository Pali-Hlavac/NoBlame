import { pagesFor, shortId } from "./format";

describe("pagesFor", () => {
  it("covers the visible rows plus a margin, clamped to the graph", () => {
    expect(pagesFor(150, 260, 100, 1, 10)).toEqual([0, 1, 2, 3]);
    expect(pagesFor(950, 999, 100, 1, 10)).toEqual([8, 9]);
  });

  it("is empty for an empty range or graph", () => {
    expect(pagesFor(0, -1, 100, 1, 10)).toEqual([]);
    expect(pagesFor(0, 5, 100, 1, 0)).toEqual([]);
  });
});

describe("shortId", () => {
  it("keeps the first eight characters", () => {
    expect(shortId("0123456789abcdef")).toBe("01234567");
  });
});
