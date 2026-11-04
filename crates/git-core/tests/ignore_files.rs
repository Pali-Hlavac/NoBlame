//! Ignoring untracked files: which ones a pattern would hide, and writing it to `.gitignore` or
//! `info/exclude` so that `git status` stops listing them.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::ignore::{IgnoreFile, add_ignore_pattern, files_hidden_by, ignore_file_path};
use git_core::repo::Repository;
use support::Fixture;
use tokio_util::sync::CancellationToken;

/// Untracked `b.log`, `logs/a.log`, `notes.txt`; `target/` already ignored.
fn untracked() -> Fixture {
    let fixture = Fixture::new();
    let root = fixture.path();
    fs::write(root.join(".gitignore"), "target/\n").unwrap();
    fixture.git(&["add", "."]);
    fixture.commit("ignore target");
    fs::create_dir_all(root.join("logs")).unwrap();
    fs::create_dir_all(root.join("target")).unwrap();
    for file in ["b.log", "logs/a.log", "notes.txt", "target/out.log"] {
        fs::write(root.join(file), "x\n").unwrap();
    }
    fixture
}

async fn hidden(fixture: &Fixture, pattern: &str) -> Vec<String> {
    let preview = files_hidden_by(
        &Git::locate().unwrap(),
        &fixture.path(),
        pattern,
        &CancellationToken::new(),
    )
    .await
    .unwrap();
    assert_eq!(preview.total, preview.files.len());
    preview.files.iter().map(ToString::to_string).collect()
}

#[tokio::test]
async fn previews_only_files_listed_now() {
    let fixture = untracked();
    assert_eq!(hidden(&fixture, "*.log").await, ["b.log", "logs/a.log"]);
    assert_eq!(hidden(&fixture, "/logs/").await, ["logs/a.log"]);
    assert_eq!(hidden(&fixture, "/b.log").await, ["b.log"]);
    // Already ignored: nothing more is hidden.
    assert!(hidden(&fixture, "target/").await.is_empty());
}

#[test]
fn written_patterns_hide_files_from_the_status() {
    let fixture = untracked();
    let repo = Repository::discover(&fixture.path()).unwrap();
    let local = repo.local();
    let shared = ignore_file_path(&local, IgnoreFile::Shared).unwrap();
    let exclude = ignore_file_path(&local, IgnoreFile::Local).unwrap();
    assert_eq!(shared, fixture.path().join(".gitignore"));
    assert!(add_ignore_pattern(&shared, "*.log").unwrap());
    assert!(add_ignore_pattern(&exclude, "/notes.txt").unwrap());
    assert_eq!(fs::read_to_string(&shared).unwrap(), "target/\n*.log\n");
    assert_eq!(
        fixture.git(&["status", "--porcelain", "--untracked-files=all"]),
        "M .gitignore"
    );
}
