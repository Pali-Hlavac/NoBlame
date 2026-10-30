import html from "../../../index.html?raw";
import component from "./BirdLoader.tsx?raw";

/** The `d` attributes of every path in `source`, in order. */
function paths(source: string): string[] {
  return [...source.matchAll(/\sd="([^"]+)"/g)].map((match) => match[1] ?? "");
}

describe("the start screen in index.html", () => {
  it("draws the same bird as BirdLoader", () => {
    expect(paths(html)).toEqual(paths(component));
    expect(paths(html).length).toBeGreaterThan(5);
  });
});
