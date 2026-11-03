//! Staging, unstaging and discarding some lines of a file, and discarding whole files, through
//! the real `git`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::commit::{
    CommitError, LineSelection, PartialChange, discard_lines, discard_paths, stage_lines,
    unstage_lines,
};
use git_core::diff::{ObjectId, read_worktree_file};
use git_core::repo::Repository;
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn git() -> Git {
    Git::locate().expect("tests need git on PATH")
}

fn write(fixture: &Fixture, name: &str, content: &str) {
    fs::write(fixture.path().join(name), content).unwrap();
}

fn read(fixture: &Fixture, name: &str) -> String {
    fs::read_to_string(fixture.path().join(name)).unwrap()
}

fn repo(fixture: &Fixture) -> gix::Repository {
    Repository::discover(&fixture.path()).unwrap().local()
}

/// The blob git has for `revision` (`HEAD:a.txt`, `:a.txt` for the index), if any.
fn blob(fixture: &Fixture, revision: &str) -> Option<ObjectId> {
    let output = std::process::Command::new("git")
        .args(["rev-parse", "--verify", "--quiet", revision])
        .current_dir(fixture.path())
        .output()
        .unwrap();
    let hex = String::from_utf8(output.stdout).unwrap();
    ObjectId::from_hex(hex.trim().as_bytes()).ok()
}

fn worktree_id(fixture: &Fixture, path: &str) -> ObjectId {
    read_worktree_file(&repo(fixture), path.into())
        .unwrap()
        .unwrap()
        .id
}

/// Single lines: `removed` by their old number, `added` by their new number.
fn lines(removed: &[u32], added: &[u32]) -> LineSelection {
    LineSelection {
        removed: removed.iter().map(|&line| line..=line).collect(),
        added: added.iter().map(|&line| line..=line).collect(),
    }
}

/// `a.txt` committed as four lines, then changed in the working tree: `two` became `2` and
/// `five` was added.
fn changed() -> Fixture {
    let fixture = Fixture::new();
    // The commands under test read the system config, which may convert line endings.
    fixture.git(&["config", "core.autocrlf", "false"]);
    write(&fixture, "a.txt", "one\ntwo\nthree\nfour\n");
    fixture.git(&["add", "a.txt"]);
    fixture.commit("base");
    write(&fixture, "a.txt", "one\n2\nthree\nfour\nfive\n");
    fixture
}

fn worktree_change(fixture: &Fixture, selection: LineSelection) -> PartialChange {
    PartialChange {
        path: "a.txt".into(),
        old: blob(fixture, ":a.txt"),
        new: worktree_id(fixture, "a.txt"),
        selection,
    }
}

#[tokio::test]
async fn stages_only_the_chosen_lines() {
    let fixture = changed();
    let change = worktree_change(&fixture, lines(&[], &[5]));
    stage_lines(&git(), repo(&fixture), change).await.unwrap();
    assert_eq!(
        fixture.git(&["show", ":a.txt"]),
        "one\ntwo\nthree\nfour\nfive"
    );
    // The working tree keeps every change.
    assert_eq!(read(&fixture, "a.txt"), "one\n2\nthree\nfour\nfive\n");
}

#[tokio::test]
async fn stages_part_of_a_new_file() {
    let fixture = changed();
    write(&fixture, "new.txt", "keep\nlater\n");
    let change = PartialChange {
        path: "new.txt".into(),
        old: None,
        new: worktree_id(&fixture, "new.txt"),
        selection: lines(&[], &[1]),
    };
    stage_lines(&git(), repo(&fixture), change).await.unwrap();
    assert_eq!(fixture.git(&["show", ":new.txt"]), "keep");
    assert!(
        fixture
            .git(&["ls-files", "--stage", "new.txt"])
            .starts_with("100644 ")
    );
}

#[tokio::test]
async fn unstages_lines_and_then_the_whole_file() {
    let fixture = changed();
    fixture.git(&["add", "a.txt"]);
    let staged = |selection| PartialChange {
        path: "a.txt".into(),
        old: blob(&fixture, "HEAD:a.txt"),
        new: blob(&fixture, ":a.txt").unwrap(),
        selection,
    };
    unstage_lines(&git(), repo(&fixture), staged(lines(&[], &[5])))
        .await
        .unwrap();
    assert_eq!(fixture.git(&["show", ":a.txt"]), "one\n2\nthree\nfour");

    // Undoing the last staged change leaves nothing staged: the file is unstaged whole.
    unstage_lines(&git(), repo(&fixture), staged(lines(&[2], &[2])))
        .await
        .unwrap();
    assert_eq!(fixture.git(&["diff", "--cached", "--name-only"]), "");
}

#[tokio::test]
async fn discards_lines_and_keeps_the_line_endings_of_a_checkout() {
    let fixture = Fixture::new();
    fixture.git(&["config", "core.autocrlf", "true"]);
    write(&fixture, "a.txt", "a\r\nb\r\n");
    fixture.git(&["add", "a.txt"]);
    fixture.commit("base");
    write(&fixture, "a.txt", "a\r\nB\r\nc\r\n");

    let change = worktree_change(&fixture, lines(&[], &[3]));
    discard_lines(&git(), repo(&fixture), change).await.unwrap();
    assert_eq!(read(&fixture, "a.txt"), "a\r\nB\r\n");
}

#[tokio::test]
async fn refuses_when_the_file_changed_since_it_was_shown() {
    let fixture = changed();
    let change = worktree_change(&fixture, lines(&[], &[5]));
    write(&fixture, "a.txt", "edited again\n");
    let Err(CommitError::Changed(path)) = stage_lines(&git(), repo(&fixture), change).await else {
        panic!("a stale version must be refused");
    };
    assert_eq!(path, "a.txt");
    assert_eq!(fixture.git(&["diff", "--cached", "--name-only"]), "");
}

#[tokio::test]
async fn discards_whole_files_and_deletes_new_ones() {
    let fixture = changed();
    write(&fixture, "[ab].txt", "new\n");
    write(&fixture, "keep.txt", "new\n");
    discard_paths(
        &git(),
        &fixture.path(),
        &["a.txt"],
        &["[ab].txt"],
        &CancellationToken::new(),
    )
    .await
    .unwrap();
    assert_eq!(read(&fixture, "a.txt"), "one\ntwo\nthree\nfour\n");
    assert!(!fixture.path().join("[ab].txt").exists());
    assert!(fixture.path().join("keep.txt").exists());
}
