import { pagesFor } from "./paging";

describe("pagesFor", () => {
  it("covers the visible rows plus a margin, clamped to the list", () => {
    expect(pagesFor(150, 260, 100, 1, 10)).toEqual([0, 1, 2, 3]);
    expect(pagesFor(950, 999, 100, 1, 10)).toEqual([8, 9]);
  });

  it("is empty for an empty range or list", () => {
    expect(pagesFor(0, -1, 100, 1, 10)).toEqual([]);
    expect(pagesFor(0, 5, 100, 1, 0)).toEqual([]);
  });
});
