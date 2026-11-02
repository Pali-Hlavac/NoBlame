import { moveSection, sectionDropIndex, sectionOrder } from "./sections";

describe("module sections", () => {
  it("cleans the saved order and adds missing sections", () => {
    expect(sectionOrder(["recent", "recent"])).toEqual(["recent", "open", "groups"]);
    expect(sectionOrder([])).toEqual(["open", "groups", "recent"]);
  });

  it("moves a section before or after the one it is dropped on", () => {
    const order = sectionOrder([]);
    expect(moveSection(order, "open", sectionDropIndex(order, "recent", "open", true))).toEqual([
      "groups",
      "recent",
      "open",
    ]);
    expect(moveSection(order, "recent", sectionDropIndex(order, "open", "recent", false))).toEqual([
      "recent",
      "open",
      "groups",
    ]);
    expect(moveSection(order, "groups", -1)).toEqual(["groups", "open", "recent"]);
  });
});
