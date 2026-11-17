import { matchingSections, noticeSections } from "./notices";

const RULE = "=".repeat(80);
const TEXT = `Intro\n\n${RULE}\nMIT\n\nUsed by:\n  - react 19\n\nPermission…\n${RULE}\nApache-2.0\n\nUsed by:\n  - tauri 2\n`;

describe("the third-party notices", () => {
  it("are split at the rules between licences", () => {
    expect(noticeSections(TEXT)).toEqual([
      "Intro",
      "MIT\n\nUsed by:\n  - react 19\n\nPermission…",
      "Apache-2.0\n\nUsed by:\n  - tauri 2",
    ]);
  });

  it("are found by every word typed, in any case", () => {
    const sections = noticeSections(TEXT);
    expect(matchingSections(sections, "React")).toHaveLength(1);
    expect(matchingSections(sections, "tauri apache")).toEqual([
      "Apache-2.0\n\nUsed by:\n  - tauri 2",
    ]);
    expect(matchingSections(sections, "  ")).toHaveLength(3);
    expect(matchingSections(sections, "gpl")).toEqual([]);
  });
});
