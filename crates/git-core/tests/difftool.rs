//! Opening a file's versions in an external diff tool: the versions written for it, and
//! `git difftool --no-index` running a command of the user's or their configured tool.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::diff::parse_object_id;
use git_core::difftool::{
    DiffTool, DiffToolError, Version, configured_tool, run_diff_tool, write_versions,
};
use git_core::repo::Repository;
use support::Fixture;
use tokio_util::sync::CancellationToken;

/// `notes.txt` committed as "committed", then edited on disk; returns its blob id.
fn edited() -> (Fixture, String) {
    let fixture = Fixture::new();
    // The user's own git runs these, with its system config (Git for Windows converts to CRLF).
    fixture.git(&["config", "core.autocrlf", "false"]);
    fs::write(fixture.path().join("notes.txt"), "committed\n").unwrap();
    fixture.git(&["add", "."]);
    fixture.commit("notes");
    let blob = fixture.git(&["rev-parse", "HEAD:notes.txt"]);
    fs::write(fixture.path().join("notes.txt"), "edited\n").unwrap();
    (fixture, blob)
}

#[tokio::test]
async fn shows_a_blob_against_the_working_tree_file() {
    let (fixture, blob) = edited();
    let folder = tempfile::tempdir().unwrap();
    let git = Git::locate().unwrap();
    let cancel = CancellationToken::new();
    let (old, new) = write_versions(
        &git,
        &fixture.path(),
        folder.path(),
        (
            "notes.txt".into(),
            Version::Blob(parse_object_id(&blob).unwrap()),
        ),
        ("notes.txt".into(), Version::WorkingTree),
        &cancel,
    )
    .await
    .unwrap();
    assert_eq!(old, folder.path().join(&blob[..8]).join("notes.txt"));
    assert_eq!(fs::read_to_string(&old).unwrap(), "committed\n");
    // The working tree file itself, so edits made in the tool are kept.
    assert_eq!(new, fixture.path().join("notes.txt"));

    let tool = DiffTool::Command("cat".to_owned());
    let printed = run_diff_tool(&git, &fixture.path(), &tool, &old, &new, &cancel)
        .await
        .unwrap();
    // What git and the tool printed, trimmed.
    assert_eq!(printed, "committed\nedited");
}

#[tokio::test]
async fn runs_the_configured_tool_and_stands_in_for_a_missing_side() {
    let (fixture, _) = edited();
    fixture.git(&["config", "diff.tool", "fake"]);
    fixture.git(&["config", "difftool.fake.cmd", "cat \"$REMOTE\" \"$LOCAL\""]);
    let repo = Repository::discover(&fixture.path()).unwrap();
    let name = configured_tool(&repo.local()).unwrap();
    assert_eq!(name, "fake");

    let folder = tempfile::tempdir().unwrap();
    let git = Git::locate().unwrap();
    let cancel = CancellationToken::new();
    let (old, new) = write_versions(
        &git,
        &fixture.path(),
        folder.path(),
        ("new.txt".into(), Version::Missing),
        ("notes.txt".into(), Version::WorkingTree),
        &cancel,
    )
    .await
    .unwrap();
    assert_eq!(fs::read(&old).unwrap(), b"");
    let printed = run_diff_tool(
        &git,
        &fixture.path(),
        &DiffTool::Tool(name),
        &old,
        &new,
        &cancel,
    )
    .await
    .unwrap();
    assert_eq!(printed, "edited");

    // An unknown tool fails with git's reason instead of git guessing another one.
    let unknown = DiffTool::Tool("no-such-tool".to_owned());
    let error = run_diff_tool(&git, &fixture.path(), &unknown, &old, &new, &cancel)
        .await
        .unwrap_err();
    assert!(
        matches!(&error, DiffToolError::Failed { output } if output.contains("no-such-tool")),
        "{error}"
    );
}
