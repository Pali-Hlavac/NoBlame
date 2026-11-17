/**
 * A small repository for the end-to-end tests, made with the real git in a temporary folder,
 * and a profile folder so the app never touches the user's settings (`NOBLAME_PROFILE_DIR`).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Runs git in `dir` and returns its output, trimmed. */
export function git(dir: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
}

export interface Fixture {
  /**
   * The repository: `main` with two commits, `feature` with one more, a changed file. The
   * profile's recent list names it, so the Welcome tab offers it.
   */
  repo: string;
  /** The app's profile folder. */
  profile: string;
  remove: () => void;
}

export function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "noblame-e2e-"));
  const repo = join(root, "repo");
  const profile = join(root, "profile");
  execFileSync("git", ["init", "--quiet", "--initial-branch=main", repo]);
  git(repo, "config", "user.name", "E2E Tester");
  git(repo, "config", "user.email", "e2e@example.com");
  git(repo, "config", "commit.gpgsign", "false");
  const commit = (file: string, text: string, message: string): void => {
    writeFileSync(join(repo, file), text);
    git(repo, "add", "--", file);
    git(repo, "commit", "--quiet", "-m", message);
  };
  commit("README.md", "# Fixture\n", "Start the fixture");
  commit("notes.txt", "one\n", "Add notes");
  git(repo, "switch", "--quiet", "-c", "feature");
  commit("feature.txt", "new\n", "Add the feature");
  git(repo, "switch", "--quiet", "main");
  writeFileSync(join(repo, "notes.txt"), "one\ntwo\n");
  // The Welcome tab lists it, as after opening it once (`repository/recent.rs`).
  mkdirSync(join(profile, "config"), { recursive: true });
  const recent = { repositories: [{ path: repo, name: "repo", lastOpened: 0 }] };
  writeFileSync(join(profile, "config", "recent-repositories.json"), JSON.stringify(recent));
  return {
    repo,
    profile,
    remove: () => {
      rmSync(root, { recursive: true, force: true });
    },
  };
}
