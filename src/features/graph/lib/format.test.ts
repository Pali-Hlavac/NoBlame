import { formatRelativeDate, shortId } from "./format";

describe("shortId", () => {
  it("keeps the first eight characters", () => {
    expect(shortId("0123456789abcdef")).toBe("01234567");
  });
});

describe("formatRelativeDate", () => {
  const now = Date.UTC(2026, 10, 2, 12, 0, 0);
  const ago = (seconds: number) => formatRelativeDate(now / 1000 - seconds, now);

  it("counts in the largest whole unit", () => {
    expect(ago(30)).toBe("just now");
    expect(ago(5 * 60)).toBe("5 min ago");
    expect(ago(3 * 3600 + 59 * 60)).toBe("3 h ago");
    expect(ago(2 * 86_400)).toBe("2 d ago");
    expect(ago(45 * 86_400)).toBe("1 mo ago");
    expect(ago(800 * 86_400)).toBe("2 y ago");
  });

  it("shows nothing for an unknown time and the date for a future one", () => {
    expect(formatRelativeDate(null, now)).toBe("");
    expect(ago(-3600)).not.toMatch(/ago/);
  });
});
