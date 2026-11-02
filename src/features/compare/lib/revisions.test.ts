import {
  describeAheadBehind,
  describeFileCount,
  isComplete,
  revisionLabel,
  swapped,
} from "./revisions";

const COMPARISON = { base: "refs/heads/main", target: "refs/heads/feature", sinceMergeBase: true };

describe("compare revisions", () => {
  it("shows references and ids short", () => {
    expect(revisionLabel("refs/remotes/origin/main")).toBe("origin/main");
    expect(revisionLabel("refs/tags/v1.0")).toBe("v1.0");
    expect(revisionLabel("0123456789abcdef0123456789abcdef01234567")).toBe("01234567");
    expect(revisionLabel(" HEAD~2 ")).toBe("HEAD~2");
  });

  it("needs both sides and swaps them", () => {
    expect(isComplete(COMPARISON)).toBe(true);
    expect(isComplete({ ...COMPARISON, target: " " })).toBe(false);
    expect(swapped(COMPARISON)).toEqual({
      base: "refs/heads/feature",
      target: "refs/heads/main",
      sinceMergeBase: true,
    });
  });

  it("describes the commits each side lacks", () => {
    expect(describeAheadBehind({ ahead: 3, behind: 1 }, COMPARISON)).toBe(
      "3 commits only in feature, 1 only in main",
    );
    expect(describeAheadBehind({ ahead: 1, behind: 0 }, COMPARISON)).toBe(
      "1 commit only in feature",
    );
    expect(describeAheadBehind({ ahead: 0, behind: 1200 }, COMPARISON)).toBe(
      "1,200 commits only in main",
    );
    expect(describeAheadBehind({ ahead: 0, behind: 0 }, COMPARISON)).toBe("Same history");
  });

  it("counts the files", () => {
    expect(describeFileCount(1, 1)).toBe("1 file differs");
    expect(describeFileCount(120_000, 100_000)).toBe("120,000 files differ (first 100,000 listed)");
  });
});
