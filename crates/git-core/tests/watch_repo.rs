//! The repository watcher on a real file system.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;
use std::sync::mpsc;
use std::time::Duration;

use git_core::repo::Repository;
use git_core::watch::{Changes, RepoWatcher, WatchPaths, gitignore_filter};
use support::Fixture;

/// Long enough for the debounce and a slow CI file system.
const WAIT: Duration = Duration::from_secs(5);
/// How long to wait for nothing to happen.
const QUIET: Duration = Duration::from_millis(1500);

fn watch(fixture: &Fixture) -> (RepoWatcher, mpsc::Receiver<Changes>) {
    let repo = Repository::discover(&fixture.path()).unwrap();
    let paths = WatchPaths::of(&repo);
    let (sender, receiver) = mpsc::channel();
    let watcher = RepoWatcher::start(
        paths,
        gitignore_filter(repo.thread_safe()),
        move |changes| {
            let _ = sender.send(changes);
        },
    )
    .unwrap();
    (watcher, receiver)
}

/// Merges everything reported within `QUIET` after the first report.
fn next(receiver: &mpsc::Receiver<Changes>) -> Changes {
    let mut changes = receiver.recv_timeout(WAIT).expect("a change was reported");
    while let Ok(more) = receiver.recv_timeout(QUIET) {
        changes.refs |= more.refs;
        changes.work_tree |= more.work_tree;
    }
    changes
}

#[test]
fn reports_edits_and_commits_but_not_ignored_files() {
    let fixture = Fixture::new();
    fs::write(fixture.path().join(".gitignore"), "target/\n").unwrap();
    fs::write(fixture.path().join("file.txt"), "one\n").unwrap();
    fixture.git(&["add", "."]);
    fixture.commit("base");
    fs::create_dir(fixture.path().join("target")).unwrap();
    let (_watcher, receiver) = watch(&fixture);

    fs::write(fixture.path().join("target").join("build.o"), "binary").unwrap();
    assert!(
        receiver.recv_timeout(QUIET).is_err(),
        "a file in an ignored folder was reported"
    );

    fs::write(fixture.path().join("file.txt"), "two\n").unwrap();
    let edit = next(&receiver);
    assert!(edit.work_tree && !edit.refs, "{edit:?}");

    fixture.git(&["commit", "--quiet", "-am", "second"]);
    let commit = next(&receiver);
    assert!(commit.refs, "{commit:?}");
}
