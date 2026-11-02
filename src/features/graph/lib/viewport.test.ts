import { MAX_SCROLL_HEIGHT_PX, ROW_HEIGHT_PX } from "./constants";
import { computeViewport, scrollTopForRow, scrollTopToReveal } from "./viewport";

const VIEWPORT = ROW_HEIGHT_PX * 20;

describe("computeViewport", () => {
  it("maps scroll pixels to rows one to one for small graphs", () => {
    const viewport = computeViewport(ROW_HEIGHT_PX * 10, VIEWPORT, 1000);
    expect(viewport.spacerHeight).toBe(1000 * ROW_HEIGHT_PX);
    expect(viewport.firstRow).toBe(10);
    expect(viewport.lastRow).toBe(30);
  });

  it("caps the scroll area and still reaches the last row of a million rows", () => {
    const rows = 1_000_000;
    const top = computeViewport(0, VIEWPORT, rows);
    expect(top.spacerHeight).toBe(MAX_SCROLL_HEIGHT_PX);
    expect(top.firstRow).toBe(0);
    const bottom = computeViewport(MAX_SCROLL_HEIGHT_PX - VIEWPORT, VIEWPORT, rows);
    expect(bottom.lastRow).toBe(rows - 1);
  });

  it("handles an empty graph", () => {
    expect(computeViewport(0, VIEWPORT, 0)).toMatchObject({
      spacerHeight: 0,
      firstRow: 0,
      lastRow: -1,
    });
  });
});

describe("scrolling to rows", () => {
  it.each([1000, 1_000_000])("scrollTopForRow puts the row at the top (%i rows)", (rows) => {
    const row = Math.floor(rows / 2);
    const scrollTop = scrollTopForRow(row, VIEWPORT, rows);
    expect(computeViewport(scrollTop, VIEWPORT, rows).firstRow).toBe(row);
  });

  it("reveals a row below the window by scrolling it to the bottom", () => {
    const scrollTop = scrollTopToReveal(25, 0, VIEWPORT, 1000);
    const viewport = computeViewport(scrollTop, VIEWPORT, 1000);
    expect(viewport.lastRow).toBeGreaterThanOrEqual(25);
    expect(viewport.firstRow).toBeGreaterThan(0);
  });

  it("does not move when the row is already visible", () => {
    expect(scrollTopToReveal(5, 0, VIEWPORT, 1000)).toBe(0);
  });

  it.each([1000, 1_000_000])(
    "puts a row below the window exactly on the bottom edge (%i rows)",
    (rows) => {
      const height = VIEWPORT + ROW_HEIGHT_PX / 2;
      const scrollTop = scrollTopToReveal(rows - 1, 0, height, rows);
      const viewport = computeViewport(scrollTop, height, rows);
      expect(viewport.virtualTop + height).toBeCloseTo(rows * ROW_HEIGHT_PX);
    },
  );

  it("keeps the last row in place when scrolled to the end at fractional scaling", () => {
    // The browser stops 0.4 px short of what the rounded clientHeight suggests.
    const rows = 82_000;
    const scrollTop = rows * ROW_HEIGHT_PX - VIEWPORT - 0.4;
    expect(scrollTopToReveal(rows - 1, scrollTop, VIEWPORT, rows)).toBe(scrollTop);
  });
});
