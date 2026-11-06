import { branchOfRemote, newNameProblem, refNameProblem } from "./names";

describe("refNameProblem", () => {
  it("accepts ordinary names", () => {
    for (const name of ["main", "feature/login", "fix-12", "v1.0.0", "ünïcode", "a/b/c"]) {
      expect(refNameProblem(name)).toBeNull();
    }
  });

  it("rejects what git rejects, saying why", () => {
    const cases: [string, RegExp][] = [
      ["", /Enter a name/],
      ["-x", /start with “-”/],
      ["HEAD", /reserved/],
      ["a b", /spaces/],
      ["a\u0001", /control/],
      ["a~1", /“~”/],
      ["a^", /“\^”/],
      ["a:b", /“:”/],
      ["a?", /“\?”/],
      ["a*", /“\*”/],
      ["a[b", /“\[”/],
      ["a\\b", /“\\”/],
      ["a..b", /“\.\.”/],
      ["a@{1}", /“@\{”/],
      ["a/", /Slashes/],
      ["/a", /Slashes/],
      ["a//b", /Slashes/],
      ["a.", /end with “\.”/],
      [".a", /start with “\.”/],
      ["a/.b", /start with “\.”/],
      ["x.lock", /“\.lock”/],
      ["x.lock/y", /“\.lock”/],
    ];
    for (const [name, message] of cases) {
      expect(refNameProblem(name), name).toMatch(message);
    }
  });
});

describe("newNameProblem", () => {
  it("names a branch or tag that exists already", () => {
    const existing = new Set(["main", "v1"]);
    expect(newNameProblem("main", existing, "branch")).toBe(
      "A branch named “main” exists already.",
    );
    expect(newNameProblem("v1", existing, "tag")).toBe("A tag named “v1” exists already.");
    expect(newNameProblem("topic", existing, "branch")).toBeNull();
  });

  it("refuses a name that would be another's folder, or inside one", () => {
    const existing = new Set(["topic", "team/a"]);
    expect(newNameProblem("topic/old", existing, "branch")).toMatch(/“topic” exists, so/);
    expect(newNameProblem("team", existing, "branch")).toMatch(/“team\/a” exists, so “team”/);
    expect(newNameProblem("team/b", existing, "branch")).toBeNull();
  });
});

describe("branchOfRemote", () => {
  it("drops the remote's name", () => {
    expect(branchOfRemote("origin/feature/x")).toBe("feature/x");
    expect(branchOfRemote("main")).toBe("main");
  });
});
