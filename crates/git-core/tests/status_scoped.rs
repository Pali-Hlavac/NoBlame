//! The status of one folder or file, and the staged files outside it (task windows).
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::status::{StatusFile, UntrackedFiles, staged_outside, working_tree_status_in};
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn write(fixture: &Fixture, name: &str, content: &str) {
    let path = fixture.path().join(name);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, content).unwrap();
}

/// Committed `src/a.txt`, `src2/b.txt` and `top.txt`; then all three changed, `src/a.txt` and
/// `top.txt` staged, and a new `src/new.txt`.
fn fixture() -> Fixture {
    let fixture = Fixture::new();
    for name in ["src/a.txt", "src2/b.txt", "top.txt"] {
        write(&fixture, name, "1\n");
    }
    fixture.git(&["add", "."]);
    fixture.commit("base");
    for name in ["src/a.txt", "src2/b.txt", "top.txt"] {
        write(&fixture, name, "2\n");
    }
    fixture.git(&["add", "src/a.txt", "top.txt"]);
    write(&fixture, "src/new.txt", "new\n");
    fixture
}

#[tokio::test]
async fn lists_only_the_files_of_the_folder() {
    let fixture = fixture();
    let git = Git::locate().expect("tests need git on PATH");
    let cancel = CancellationToken::new();
    let status = working_tree_status_in(&git, &fixture.path(), UntrackedFiles::All, "src", &cancel)
        .await
        .unwrap();
    let staged: Vec<_> = status.staged.iter().map(StatusFile::display_path).collect();
    let unstaged: Vec<_> = status
        .unstaged
        .iter()
        .map(StatusFile::display_path)
        .collect();
    // `src2/b.txt` shares the prefix but is another folder.
    assert_eq!(staged, ["src/a.txt"]);
    assert_eq!(unstaged, ["src/new.txt"]);
    assert_eq!(status.summary.untracked, 1);

    let file = working_tree_status_in(
        &git,
        &fixture.path(),
        UntrackedFiles::All,
        "top.txt",
        &cancel,
    )
    .await
    .unwrap();
    assert_eq!(file.staged.len(), 1);
    assert!(file.unstaged.is_empty());
}

#[tokio::test]
async fn counts_the_staged_files_outside_the_folder() {
    let fixture = fixture();
    let git = Git::locate().expect("tests need git on PATH");
    let cancel = CancellationToken::new();
    let count = |scope: &'static str| {
        let git = git.clone();
        let path = fixture.path();
        let cancel = cancel.clone();
        async move { staged_outside(&git, &path, scope, &cancel).await.unwrap() }
    };
    assert_eq!(count("src").await, 1, "top.txt");
    assert_eq!(count("src2").await, 2, "src/a.txt and top.txt");
    assert_eq!(count("top.txt").await, 1, "src/a.txt");
}
