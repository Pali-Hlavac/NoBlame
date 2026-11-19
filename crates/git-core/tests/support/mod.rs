//! Scripted fixture repositories for integration tests. Git runs with an empty global config,
//! no system config, a fixed identity and a fixed clock, so results are reproducible.

#![allow(dead_code, clippy::unwrap_used, clippy::expect_used)]

use std::cell::Cell;
use std::path::{Path, PathBuf};
use std::process::Command;

/// First commit time used by fixtures (2020-09-13).
const START_TIME: i64 = 1_600_000_000;

/// A temporary repository driven through the real `git`.
pub struct Fixture {
    dir: tempfile::TempDir,
    config: PathBuf,
    clock: Cell<i64>,
}

impl Fixture {
    /// `git init` with `main` as the initial branch.
    pub fn new() -> Self {
        Self::with_init(&["init", "--quiet", "--initial-branch=main", "repo"])
    }

    /// A bare repository.
    pub fn bare() -> Self {
        Self::with_init(&["init", "--quiet", "--bare", "--initial-branch=main", "repo"])
    }

    fn with_init(args: &[&str]) -> Self {
        let dir = tempfile::tempdir().unwrap();
        let config = dir.path().join("empty-gitconfig");
        std::fs::write(&config, "").unwrap();
        let fixture = Self {
            dir,
            config,
            clock: Cell::new(START_TIME),
        };
        fixture.run(fixture.dir.path(), args);
        fixture
    }

    /// The repository (work tree, or the bare repository itself).
    pub fn path(&self) -> PathBuf {
        self.dir.path().join("repo")
    }

    /// A sibling folder of the repository inside the same temporary directory.
    pub fn sibling(&self, name: &str) -> PathBuf {
        self.dir.path().join(name)
    }

    /// Runs git in the repository and returns trimmed stdout.
    pub fn git(&self, args: &[&str]) -> String {
        self.run(&self.path(), args)
    }

    /// Runs git in the repository with the fixture's environment and returns its output, for a
    /// command expected to fail (a merge stopping on a conflict).
    pub fn try_git(&self, args: &[&str]) -> std::process::Output {
        self.command(&self.path(), args).output().unwrap()
    }

    /// Runs git in `cwd`.
    pub fn run(&self, cwd: &Path, args: &[&str]) -> String {
        let output = self.command(cwd, args).output().unwrap();
        assert!(
            output.status.success(),
            "git {args:?} failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8_lossy(&output.stdout).trim().to_owned()
    }

    /// `git <args>` in `cwd` with an empty global config, no system config, a fixed identity and
    /// the fixture's clock: never the machine's own settings.
    fn command(&self, cwd: &Path, args: &[&str]) -> Command {
        let time = format!("{} +0000", self.clock.get());
        let mut command = Command::new("git");
        command
            .args(args)
            .current_dir(cwd)
            .env("GIT_CONFIG_GLOBAL", &self.config)
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .env("GIT_AUTHOR_NAME", "Ada Lovelace")
            .env("GIT_AUTHOR_EMAIL", "ada@example.com")
            .env("GIT_COMMITTER_NAME", "Ada Lovelace")
            .env("GIT_COMMITTER_EMAIL", "ada@example.com")
            .env("GIT_AUTHOR_DATE", &time)
            .env("GIT_COMMITTER_DATE", &time)
            .env("LC_ALL", "C");
        command
    }

    /// An empty commit on the current branch, one minute after the previous one.
    pub fn commit(&self, message: &str) -> String {
        self.clock.set(self.clock.get() + 60);
        self.git(&["commit", "--quiet", "--allow-empty", "-m", message]);
        self.git(&["rev-parse", "HEAD"])
    }

    /// A commit whose message is the given raw bytes (for non-UTF-8 tests).
    pub fn commit_bytes(&self, message: &[u8]) -> String {
        self.clock.set(self.clock.get() + 60);
        let file = self.dir.path().join("message.txt");
        std::fs::write(&file, message).unwrap();
        let file = file.to_string_lossy().into_owned();
        self.git(&[
            "-c",
            "i18n.commitEncoding=ISO-8859-1",
            "commit",
            "--quiet",
            "--allow-empty",
            "-F",
            &file,
        ]);
        self.git(&["rev-parse", "HEAD"])
    }

    /// A merge commit of `branch` into the current branch.
    pub fn merge(&self, branch: &str, message: &str) -> String {
        self.clock.set(self.clock.get() + 60);
        self.git(&["merge", "--quiet", "--no-ff", "-m", message, branch]);
        self.git(&["rev-parse", "HEAD"])
    }
}
