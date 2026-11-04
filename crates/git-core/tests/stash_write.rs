//! Making, applying, popping and dropping stashes, a stash's files, and applying some of them,
//! through the real `git`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::repo::Repository;
use git_core::stash::{
    StashError, StashOptions, apply_stash, apply_stash_files, check_stash, drop_stash,
    list_stashes, push_stash, stash_files,
};
use gix::ObjectId;
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

/// `a.txt` and `b.txt` committed; the stash commands run with the test process's environment, so
/// the identity is set in the repository.
fn committed() -> Fixture {
    let fixture = Fixture::new();
    fixture.git(&["config", "user.name", "Ada Lovelace"]);
    fixture.git(&["config", "user.email", "ada@example.com"]);
    fixture.git(&["config", "core.autocrlf", "false"]);
    write(&fixture, "a.txt", "a\n");
    write(&fixture, "b.txt", "b\n");
    fixture.git(&["add", "--all"]);
    fixture.commit("base");
    fixture
}

fn status(fixture: &Fixture) -> String {
    fixture.git(&["status", "--porcelain", "--untracked-files=all"])
}

fn newest(fixture: &Fixture) -> (u32, ObjectId) {
    let stash = list_stashes(&repo(fixture)).unwrap().remove(0);
    (
        stash.index,
        ObjectId::from_hex(stash.id.as_bytes()).unwrap(),
    )
}

#[tokio::test]
async fn stashes_chosen_files_with_a_message_and_untracked_ones() {
    let fixture = committed();
    write(&fixture, "a.txt", "a changed\n");
    write(&fixture, "b.txt", "b changed\n");
    write(&fixture, "new.txt", "new\n");
    let (git, cancel) = (git(), CancellationToken::new());
    let options = StashOptions {
        message: "half done".to_owned(),
        include_untracked: true,
        paths: Some(vec![b"a.txt".to_vec(), b"new.txt".to_vec()]),
        ..StashOptions::default()
    };
    push_stash(&git, &fixture.path(), &options, &cancel)
        .await
        .unwrap();

    assert_eq!(status(&fixture), "M b.txt");
    assert_eq!(read(&fixture, "a.txt"), "a\n");
    let stashes = list_stashes(&repo(&fixture)).unwrap();
    assert_eq!(stashes[0].message, "On main: half done");

    let files = stash_files(&repo(&fixture), newest(&fixture).1).unwrap();
    let changed: Vec<String> = files.changed.iter().map(|f| f.path.to_string()).collect();
    let untracked: Vec<String> = files.untracked.iter().map(|f| f.path.to_string()).collect();
    assert_eq!(
        (changed, untracked),
        (vec!["a.txt".into()], vec!["new.txt".into()])
    );
}

#[tokio::test]
async fn nothing_to_stash_is_an_error() {
    let fixture = committed();
    let (git, cancel) = (git(), CancellationToken::new());
    let result = push_stash(&git, &fixture.path(), &StashOptions::default(), &cancel).await;
    assert!(
        matches!(result, Err(StashError::NothingToStash)),
        "{result:?}"
    );
}

#[tokio::test]
async fn keeps_the_index_and_restores_it_on_apply() {
    let fixture = committed();
    write(&fixture, "a.txt", "a staged\n");
    fixture.git(&["add", "a.txt"]);
    write(&fixture, "b.txt", "b changed\n");
    let (git, cancel) = (git(), CancellationToken::new());
    let options = StashOptions {
        keep_index: true,
        ..StashOptions::default()
    };
    push_stash(&git, &fixture.path(), &options, &cancel)
        .await
        .unwrap();
    assert_eq!(status(&fixture), "M  a.txt");

    fixture.git(&["reset", "--hard", "--quiet"]);
    let (index, id) = newest(&fixture);
    check_stash(&repo(&fixture), index, id).unwrap();
    let outcome = apply_stash(&git, &fixture.path(), index, false, true, &cancel)
        .await
        .unwrap();
    assert!(!outcome.conflicts);
    assert_eq!(status(&fixture), "M  a.txt\n M b.txt");
    assert_eq!(list_stashes(&repo(&fixture)).unwrap().len(), 1);
}

#[tokio::test]
async fn a_conflicting_pop_applies_and_keeps_the_stash() {
    let fixture = committed();
    write(&fixture, "a.txt", "stashed\n");
    let (git, cancel) = (git(), CancellationToken::new());
    push_stash(&git, &fixture.path(), &StashOptions::default(), &cancel)
        .await
        .unwrap();
    write(&fixture, "a.txt", "committed meanwhile\n");
    fixture.git(&["commit", "--quiet", "-am", "meanwhile"]);

    let outcome = apply_stash(&git, &fixture.path(), 0, true, false, &cancel)
        .await
        .unwrap();
    assert!(outcome.conflicts, "{}", outcome.output);
    assert_eq!(status(&fixture), "UU a.txt");
    assert_eq!(list_stashes(&repo(&fixture)).unwrap().len(), 1);
}

#[tokio::test]
async fn local_changes_in_the_way_change_nothing() {
    let fixture = committed();
    write(&fixture, "a.txt", "stashed\n");
    let (git, cancel) = (git(), CancellationToken::new());
    push_stash(&git, &fixture.path(), &StashOptions::default(), &cancel)
        .await
        .unwrap();
    write(&fixture, "a.txt", "typed since\n");
    let result = apply_stash(&git, &fixture.path(), 0, true, false, &cancel).await;
    let Err(StashError::Rejected { output }) = result else {
        panic!("applying over local changes must fail: {result:?}");
    };
    assert!(output.contains("would be overwritten"), "{output}");
    assert_eq!(read(&fixture, "a.txt"), "typed since\n");
}

#[tokio::test]
async fn drops_only_the_stash_that_was_shown() {
    let fixture = committed();
    let (git, cancel) = (git(), CancellationToken::new());
    write(&fixture, "a.txt", "first\n");
    push_stash(&git, &fixture.path(), &StashOptions::default(), &cancel)
        .await
        .unwrap();
    let (_, first) = newest(&fixture);
    write(&fixture, "a.txt", "second\n");
    push_stash(&git, &fixture.path(), &StashOptions::default(), &cancel)
        .await
        .unwrap();

    // The first stash is stash@{1} now.
    let moved = check_stash(&repo(&fixture), 0, first);
    assert!(
        matches!(moved, Err(StashError::Moved { index: 0 })),
        "{moved:?}"
    );
    check_stash(&repo(&fixture), 1, first).unwrap();
    drop_stash(&git, &fixture.path(), 1, &cancel).await.unwrap();
    let left = list_stashes(&repo(&fixture)).unwrap();
    assert_eq!(left.len(), 1);
    assert_ne!(left[0].id, first.to_string());
}

#[tokio::test]
async fn applies_chosen_files_onto_a_moved_branch_and_keeps_the_stash() {
    let fixture = committed();
    write(&fixture, "a.txt", "a\nstashed line\n");
    write(&fixture, "b.txt", "b stashed\n");
    write(&fixture, "new.txt", "new\n");
    let (git, cancel) = (git(), CancellationToken::new());
    let options = StashOptions {
        include_untracked: true,
        ..StashOptions::default()
    };
    push_stash(&git, &fixture.path(), &options, &cancel)
        .await
        .unwrap();
    // The branch moves on: a.txt gets a line before the stashed change.
    write(&fixture, "a.txt", "first line\na\n");
    fixture.git(&["commit", "--quiet", "-am", "moved on"]);

    let files = stash_files(&repo(&fixture), newest(&fixture).1).unwrap();
    let outcome = apply_stash_files(
        &git,
        &fixture.path(),
        &files.commits,
        &[b"a.txt"],
        &[b"new.txt"],
        &cancel,
    )
    .await
    .unwrap();

    assert!(!outcome.conflicts, "{}", outcome.output);
    assert_eq!(read(&fixture, "a.txt"), "first line\na\nstashed line\n");
    assert_eq!(read(&fixture, "b.txt"), "b\n");
    assert_eq!(read(&fixture, "new.txt"), "new\n");
    assert_eq!(status(&fixture), "M a.txt\n?? new.txt");
    assert_eq!(list_stashes(&repo(&fixture)).unwrap().len(), 1);

    // Again with b.txt: new.txt is in the way now, so nothing applies at all.
    let again = apply_stash_files(
        &git,
        &fixture.path(),
        &files.commits,
        &[b"b.txt"],
        &[b"new.txt"],
        &cancel,
    )
    .await;
    assert!(
        matches!(again, Err(StashError::Rejected { .. })),
        "{again:?}"
    );
    assert_eq!(read(&fixture, "b.txt"), "b\n");

    // a.txt has local changes now: refused, naming it.
    let changed = apply_stash_files(
        &git,
        &fixture.path(),
        &files.commits,
        &[b"a.txt"],
        &[] as &[&[u8]],
        &cancel,
    )
    .await;
    let Err(StashError::Rejected { output }) = changed else {
        panic!("local changes must be refused: {changed:?}");
    };
    assert!(output.contains("a.txt"), "{output}");
}

#[tokio::test]
async fn a_chosen_file_that_conflicts_is_marked_like_a_stash_apply() {
    let fixture = committed();
    write(&fixture, "a.txt", "stashed\n");
    write(&fixture, "b.txt", "b stashed\n");
    let (git, cancel) = (git(), CancellationToken::new());
    push_stash(&git, &fixture.path(), &StashOptions::default(), &cancel)
        .await
        .unwrap();
    write(&fixture, "a.txt", "committed meanwhile\n");
    fixture.git(&["commit", "--quiet", "-am", "meanwhile"]);

    let files = stash_files(&repo(&fixture), newest(&fixture).1).unwrap();
    let outcome = apply_stash_files(
        &git,
        &fixture.path(),
        &files.commits,
        &[b"a.txt", b"b.txt"],
        &[] as &[&[u8]],
        &cancel,
    )
    .await
    .unwrap();
    assert!(outcome.conflicts, "{}", outcome.output);
    assert_eq!(status(&fixture), "UU a.txt\n M b.txt");
    assert!(read(&fixture, "a.txt").contains("<<<<<<<"));
}
