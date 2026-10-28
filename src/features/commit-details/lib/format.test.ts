import { formatOffset, formatSignatureDate, splitMessage } from "./format";

describe("formatSignatureDate", () => {
  it("shows the time in the signature's own zone, like git --date=iso", () => {
    // 2026-10-27 12:03:11 UTC
    expect(formatSignatureDate(1_793_102_591, 120)).toBe("2026-10-27 14:03:11 +0200");
    expect(formatSignatureDate(1_793_102_591, -330)).toBe("2026-10-27 06:33:11 -0530");
  });

  it("is empty for an unknown time", () => {
    expect(formatSignatureDate(null, 0)).toBe("");
  });
});

describe("formatOffset", () => {
  it("pads hours and minutes", () => {
    expect(formatOffset(0)).toBe("+0000");
    expect(formatOffset(-60)).toBe("-0100");
  });
});

describe("splitMessage", () => {
  it("separates the summary from the body", () => {
    expect(splitMessage("Fix it\r\n\r\nBecause.\n")).toEqual({
      summary: "Fix it",
      body: "Because.",
    });
    expect(splitMessage("Only a line")).toEqual({ summary: "Only a line", body: "" });
  });
});
