import { checkSummary, isAuthor, withoutComments } from "./message";

describe("checkSummary", () => {
  it("measures the first line with text against 50 and 72 characters", () => {
    expect(checkSummary("")).toEqual({ length: 0, level: "ok", secondLineUsed: false });
    expect(checkSummary("\n\nFix the parser  \n\nBody")).toEqual({
      length: 14,
      level: "ok",
      secondLineUsed: false,
    });
    expect(checkSummary("x".repeat(51)).level).toBe("long");
    expect(checkSummary("x".repeat(72)).level).toBe("long");
    expect(checkSummary("x".repeat(73)).level).toBe("too-long");
  });

  it("counts characters, not UTF-16 units", () => {
    expect(checkSummary("Add 🐦 icon").length).toBe(10);
  });

  it("notices text on the line after the summary", () => {
    expect(checkSummary("Summary\nmore summary").secondLineUsed).toBe(true);
    expect(checkSummary("Summary\n  \nBody").secondLineUsed).toBe(false);
  });
});

describe("withoutComments", () => {
  it("drops lines starting with the comment character only", () => {
    expect(withoutComments("Fix\n# Why?\n  # kept\nBody", "#")).toBe("Fix\n  # kept\nBody");
    expect(withoutComments("Fix\n; note\n#42", ";")).toBe("Fix\n#42");
  });
});

describe("isAuthor", () => {
  it("accepts Name <email> and refuses anything git would read differently", () => {
    expect(isAuthor(" Grace Hopper <grace@example.com> ")).toBe(true);
    for (const wrong of [
      "",
      "Grace",
      "<grace@example.com>",
      "Grace <>",
      "Grace <grace@example.com",
      "Gr<ace <grace@example.com>",
      "Grace\nHopper <grace@example.com>",
    ]) {
      expect(isAuthor(wrong)).toBe(false);
    }
  });
});
