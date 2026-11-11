import { scriptProblem, withoutGit } from "./scripts";

describe("scriptProblem", () => {
  const scripts = [{ name: "Stats" }];

  it("accepts a git command line with placeholders", () => {
    expect(scriptProblem("Show", "git log --stat -1 {sha}", scripts)).toBeNull();
    expect(scriptProblem("Tag", 'tag -m "{subject}" done-{short}', scripts)).toBeNull();
  });

  it("says what is missing or wrong", () => {
    expect(scriptProblem(" ", "log", scripts)).toBe("Give the script a name.");
    expect(scriptProblem("Stats", "log", scripts)).toBe("A script has this name already.");
    expect(scriptProblem("X", "git", scripts)).toMatch(/Write git's arguments/);
    expect(scriptProblem("X", 'log "open', scripts)).toBe("A quote is not closed.");
    expect(scriptProblem("X", "log {commit}", scripts)).toMatch(/\{commit\} is not a placeholder/);
  });
});

describe("withoutGit", () => {
  it("drops a leading git", () => {
    expect(withoutGit("  git log {sha} ")).toBe("log {sha}");
    expect(withoutGit("gitk")).toBe("gitk");
  });
});
