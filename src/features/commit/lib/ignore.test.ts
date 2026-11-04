import { escapePattern, ignoreChoices } from "./ignore";

function patterns(path: string): Record<string, string> {
  return Object.fromEntries(ignoreChoices(path).map((choice) => [choice.id, choice.pattern]));
}

describe("ignoreChoices", () => {
  it("offers the file, its name, its extension and its folder", () => {
    expect(patterns("logs/today.log")).toEqual({
      path: "/logs/today.log",
      name: "today.log",
      extension: "*.log",
      folder: "/logs/",
    });
  });

  it("offers no extension for dot files and no folder at the top", () => {
    expect(patterns(".env")).toEqual({ path: "/.env", name: ".env" });
  });

  it("offers an untracked folder itself or every folder of that name", () => {
    const choices = ignoreChoices("build/out/");
    expect(choices.map((choice) => choice.label)).toEqual([
      "Only this folder",
      "Every folder named out",
      "The folder build/",
    ]);
    expect(patterns("build/out/")).toMatchObject({ path: "/build/out/", name: "out/" });
  });

  it("escapes wildcards, a leading # or ! and a last space", () => {
    expect(escapePattern("a*b?[c]\\d")).toBe("a\\*b\\?\\[c]\\\\d");
    expect(escapePattern("name ")).toBe("name\\ ");
    expect(patterns("#notes")).toMatchObject({ path: "/#notes", name: "\\#notes" });
    expect(patterns("!keep")).toMatchObject({ name: "\\!keep" });
  });
});
