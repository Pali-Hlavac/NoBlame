import type { WorkingFileDto } from "@/shared/ipc/bindings";

import { discardPlan } from "./discard";

function file(path: string, status: WorkingFileDto["status"]): WorkingFileDto {
  return {
    path,
    previousPath: null,
    status,
    oldId: null,
    newId: null,
    worktree: true,
    submodule: false,
    submoduleChanges: null,
  };
}

describe("discardPlan", () => {
  it("names the one file and what happens to it", () => {
    const changed = discardPlan([file("src/a.ts", "modified")], { all: false, truncated: false });
    expect(changed?.title).toBe("Discard the changes to src/a.ts?");
    expect(changed?.files).toEqual({ tracked: ["src/a.ts"], untracked: [] });
    const added = discardPlan([file("new.txt", "untracked")], { all: false, truncated: false });
    expect(added?.title).toBe("Delete new.txt?");
    expect(added?.description).toContain("deleted for good");
  });

  it("names how many chosen files it discards", () => {
    const plan = discardPlan([file("a", "modified"), file("b", "untracked")], {
      all: false,
      truncated: false,
    });
    expect(plan?.title).toBe("Discard the changes to 2 files?");
    expect(plan?.description).toContain("1 changed file goes back to the staged version (a)");
    expect(plan?.description).toContain("1 new file is deleted (b)");
  });
  it("counts everything, leaves conflicts alone and says what was not listed", () => {
    const plan = discardPlan(
      [
        file("a", "modified"),
        file("b", "deleted"),
        file("c", "untracked"),
        file("d", "conflicted"),
      ],
      { all: true, truncated: true },
    );
    expect(plan?.files).toEqual({ tracked: ["a", "b"], untracked: ["c"] });
    expect(plan?.description).toBe(
      "2 changed files go back to the staged version (a, b); 1 new file is deleted (c). " +
        "1 conflicted file or submodule is left as it is. Only the files listed are discarded. " +
        "NoBlame keeps no copy, so this cannot be undone.",
    );
  });

  it("has nothing to discard when only conflicts are left", () => {
    expect(discardPlan([file("d", "conflicted")], { all: true, truncated: false })).toBeNull();
  });
});
