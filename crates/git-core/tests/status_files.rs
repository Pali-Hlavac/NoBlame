//! The working tree status and its files, read through the real `git`; working tree files as
//! git would store them.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::diff::{DiffOptions, LineKind, read_worktree_file, worktree_diff};
use git_core::repo::Repository;
use git_core::status::{
    FileState, StatusFile, StatusSummary, UntrackedFiles, WorkingTreeStatus, working_tree_status,
};
use gix::ObjectId;
use support::Fixture;
use tokio_util::sync::CancellationToken;

async fn status(fixture: &Fixture, untracked: UntrackedFiles) -> WorkingTreeStatus {
    let git = Git::locate().expect("tests need git on PATH");
    working_tree_status(&git, &fixture.path(), untracked, &CancellationToken::new())
        .await
        .unwrap()
}

fn write(fixture: &Fixture, name: &str, content: &str) {
    fs::write(fixture.path().join(name), content).unwrap();
}

/// The blob id git gives `revision` (`HEAD:a.txt`, `:a.txt` for the index).
fn blob(fixture: &Fixture, revision: &str) -> ObjectId {
    ObjectId::from_hex(fixture.git(&["rev-parse", revision]).as_bytes()).unwrap()
}

fn find<'a>(files: &'a [StatusFile], path: &str) -> &'a StatusFile {
    files.iter().find(|file| file.path == path).unwrap()
}

/// A committed `a.txt` and `b.txt`; then `a.txt` staged and changed again, `b.txt` changed,
/// two files in a new folder and one loose file.
fn changed_fixture() -> Fixture {
    let fixture = Fixture::new();
    write(&fixture, "a.txt", "a\n");
    write(&fixture, "b.txt", "b\n");
    fixture.git(&["add", "a.txt", "b.txt"]);
    fixture.commit("base");
    write(&fixture, "a.txt", "a2\n");
    fixture.git(&["add", "a.txt"]);
    write(&fixture, "a.txt", "a3\n");
    write(&fixture, "b.txt", "b2\n");
    fs::create_dir(fixture.path().join("new")).unwrap();
    write(&fixture, "new/one.txt", "1\n");
    write(&fixture, "new/two.txt", "2\n");
    write(&fixture, "loose.txt", "x\n");
    fixture
}

#[tokio::test]
async fn lists_staged_changed_and_untracked_files() {
    let fixture = changed_fixture();
    let status = status(&fixture, UntrackedFiles::All).await;
    assert_eq!(
        status.summary,
        StatusSummary {
            staged: 1,
            unstaged: 2,
            untracked: 3,
            conflicted: 0
        }
    );
    let staged = find(&status.staged, "a.txt");
    assert_eq!(staged.state, FileState::Modified);
    assert_eq!(staged.old_id, Some(blob(&fixture, "HEAD:a.txt")));
    assert_eq!(staged.new_id, Some(blob(&fixture, ":a.txt")));
    let paths: Vec<_> = status
        .unstaged
        .iter()
        .map(|file| file.path.to_string())
        .collect();
    assert_eq!(
        paths,
        ["a.txt", "b.txt", "loose.txt", "new/one.txt", "new/two.txt"]
    );
    let changed = find(&status.unstaged, "a.txt");
    assert_eq!(changed.old_id, Some(blob(&fixture, ":a.txt")));
    assert!(changed.in_worktree);
    assert_eq!(
        find(&status.unstaged, "new/one.txt").state,
        FileState::Untracked
    );
}

#[tokio::test]
async fn untracked_files_can_be_left_out() {
    let fixture = changed_fixture();
    let repo = Repository::discover(&fixture.path()).unwrap().local();
    assert_eq!(UntrackedFiles::configured(&repo), UntrackedFiles::All);
    fixture.git(&["config", "status.showUntrackedFiles", "no"]);
    let repo = Repository::discover(&fixture.path()).unwrap().local();
    assert_eq!(UntrackedFiles::configured(&repo), UntrackedFiles::No);
    let status = status(&fixture, UntrackedFiles::No).await;
    assert_eq!(status.summary.untracked, 0);
    assert_eq!(status.unstaged.len(), 2);
}

#[tokio::test]
async fn lists_conflicts_against_our_version() {
    let fixture = Fixture::new();
    write(&fixture, "c.txt", "base\n");
    fixture.git(&["add", "c.txt"]);
    fixture.commit("base");
    fixture.git(&["checkout", "--quiet", "-b", "topic"]);
    write(&fixture, "c.txt", "topic\n");
    fixture.git(&["commit", "--quiet", "-am", "topic"]);
    fixture.git(&["checkout", "--quiet", "main"]);
    write(&fixture, "c.txt", "main\n");
    fixture.git(&["commit", "--quiet", "-am", "main"]);
    // The merge stops on the conflict; the fixture's `git` helper would fail on that exit code.
    let merge = std::process::Command::new("git")
        .args(["merge", "--quiet", "topic"])
        .current_dir(fixture.path())
        .output()
        .unwrap();
    assert!(!merge.status.success());

    let status = status(&fixture, UntrackedFiles::All).await;
    assert_eq!(status.summary.conflicted, 1);
    let conflict = find(&status.unstaged, "c.txt");
    assert_eq!(conflict.state, FileState::Conflicted);
    assert_eq!(conflict.old_id, Some(blob(&fixture, ":2:c.txt")));
    assert!(conflict.in_worktree);
}

#[test]
fn working_tree_files_are_read_as_git_stores_them() {
    let fixture = Fixture::new();
    fixture.git(&["config", "core.autocrlf", "true"]);
    write(&fixture, "crlf.txt", "one\r\ntwo\r\n");
    fixture.git(&["add", "crlf.txt"]);
    fixture.commit("base");
    write(&fixture, "crlf.txt", "one\r\ntwo\r\nthree\r\n");

    let repo = Repository::discover(&fixture.path()).unwrap().local();
    let file = read_worktree_file(&repo, "crlf.txt".into())
        .unwrap()
        .unwrap();
    assert_eq!(file.data.as_deref(), Some(&b"one\ntwo\nthree\n"[..]));
    let hashed = fixture.git(&["hash-object", "crlf.txt"]);
    assert_eq!(file.id.to_string(), hashed);

    let old = Some(blob(&fixture, ":crlf.txt"));
    let diff = worktree_diff(&repo, old, file, DiffOptions::default()).unwrap();
    assert_eq!((diff.additions(), diff.deletions()), (1, 0));
    let added = diff.lines(0, diff.row_count());
    assert!(
        added
            .iter()
            .any(|line| line.kind == LineKind::Added && line.text == "three")
    );
}

#[test]
fn missing_files_folders_and_outside_paths() {
    let fixture = Fixture::new();
    fs::create_dir(fixture.path().join("folder")).unwrap();
    let repo = Repository::discover(&fixture.path()).unwrap().local();
    assert_eq!(
        read_worktree_file(&repo, "absent.txt".into()).unwrap(),
        None
    );
    assert_eq!(read_worktree_file(&repo, "folder".into()).unwrap(), None);
    assert!(read_worktree_file(&repo, "../outside.txt".into()).is_err());
    assert!(read_worktree_file(&repo, "".into()).is_err());
}
