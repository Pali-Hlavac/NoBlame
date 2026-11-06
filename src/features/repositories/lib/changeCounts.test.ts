import { describe, expect, it } from "vitest";

import { describeChangeCounts } from "./changeCounts";

describe("describeChangeCounts", () => {
  it("is empty for a clean working tree", () => {
    expect(describeChangeCounts({ added: 0, changed: 0, deleted: 0 })).toBe("");
  });

  it("names only the kinds there are", () => {
    expect(describeChangeCounts({ added: 0, changed: 1, deleted: 0 })).toBe(
      "1 changed file not committed",
    );
    expect(describeChangeCounts({ added: 2, changed: 0, deleted: 1 })).toBe(
      "2 new and 1 deleted files not committed",
    );
    expect(describeChangeCounts({ added: 3, changed: 2, deleted: 1 })).toBe(
      "3 new, 2 changed and 1 deleted files not committed",
    );
  });
});
