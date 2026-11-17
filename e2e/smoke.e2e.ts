/**
 * Smoke test of the real app (ADR 0016): open a repository and browse its history, commit,
 * create a branch, and merge from the Merge window. Each step is checked in the repository with
 * git, so the test does not depend on how the UI draws the result.
 */
import type { ChildProcess } from "node:child_process";

import { makeFixture, git, type Fixture } from "./support/fixture";
import { App, KEY, startDriver, waitFor } from "./support/webdriver";

let fixture: Fixture;
let driver: ChildProcess;

beforeAll(async () => {
  fixture = makeFixture();
  // tauri-driver passes its environment on to the app.
  process.env.NOBLAME_PROFILE_DIR = fixture.profile;
  driver = await startDriver();
});

afterAll(() => {
  driver.kill();
  fixture.remove();
});

describe("the main window", () => {
  let app: App;

  beforeAll(async () => {
    app = await App.start();
    await app.clickButton(fixture.repo);
  });

  afterAll(async () => {
    await app.quit();
  });

  it("opens the repository and shows its history", async () => {
    const rows = await waitFor("the commit graph", async () => {
      const shown = await app.graphRows();
      return shown.some((row) => row.includes("Add the feature")) && shown;
    });
    expect(rows.join("\n")).toContain("Add notes");
    expect(rows.join("\n")).toContain("Start the fixture");
  });

  it("commits a change", async () => {
    await app.press(KEY.alt, "7");
    await app.clickButton("Stage all");
    await waitFor("the change to be staged", () =>
      git(fixture.repo, "diff", "--cached", "--name-only").includes("notes.txt"),
    );
    await app.focusField("Commit message");
    await app.type("Write more notes");
    await app.press(KEY.control, KEY.enter);
    await waitFor("the commit", () =>
      git(fixture.repo, "log", "-1", "--format=%s").includes("Write more notes"),
    );
    await waitFor("the commit in the graph", async () =>
      (await app.graphRows()).some((row) => row.includes("Write more notes")),
    );
  });

  it("creates a branch", async () => {
    await app.press(KEY.control, KEY.shift, "n");
    await app.focusField("Branch name");
    await app.type(`e2e-branch${KEY.enter}`);
    await waitFor("the branch", () =>
      git(fixture.repo, "branch", "--list", "e2e-branch").includes("e2e-branch"),
    );
  });
});

describe("the Merge window", () => {
  it("merges a branch into the current one", async () => {
    // The branch created above is checked out only if the dialog said so; merge into main.
    git(fixture.repo, "switch", "--quiet", "main");
    const app = await App.start();
    try {
      const windows = await app.windowCount();
      await app.invoke("open_task_window", { task: "merge", path: fixture.repo });
      await app.switchToNewWindow(windows);
      await app.focusField("Branch, tag, commit id or HEAD~2…");
      await app.type(`feature${KEY.enter}`);
      await app.clickButton("Merge");
      await waitFor("the merge", () => {
        const parents = git(fixture.repo, "log", "-1", "--format=%P").split(" ");
        return parents.length === 2 && git(fixture.repo, "log", "-1", "--format=%s");
      });
      expect(git(fixture.repo, "ls-files")).toContain("feature.txt");
    } finally {
      await app.quit();
    }
  });
});
