import { describe, expect, it } from "vitest";

import { WHOLE_FILE_CONTEXT, contextLabel, requestedContext, stepContext } from "./diff";

describe("stepContext", () => {
  it("steps through the list and stops at its ends", () => {
    expect(stepContext(3, 1)).toBe(4);
    expect(stepContext(10, 1)).toBe(15);
    expect(stepContext(10, -1)).toBe(8);
    expect(stepContext(0, -1)).toBe(0);
    expect(stepContext(100, 1)).toBe(100);
  });

  it("joins the list from a number that is not on it", () => {
    expect(stepContext(7, 1)).toBe(8);
    expect(stepContext(7, -1)).toBe(6);
  });
});

describe("context", () => {
  it("labels and requests lines", () => {
    expect(contextLabel(1)).toBe("1 line");
    expect(contextLabel(25)).toBe("25 lines");
    expect(requestedContext({ contextLines: 5, wholeFile: false })).toBe(5);
    expect(requestedContext({ contextLines: 5, wholeFile: true })).toBe(WHOLE_FILE_CONTEXT);
  });
});
