//! Reading the stash list with gix, checked against `git stash list`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use git_core::repo::Repository;
use git_core::stash::{list_stashes, stash_bases};
use support::Fixture;

#[test]
fn no_stashes_is_an_empty_list() {
    let fixture = Fixture::new();
    fixture.commit("base");
    let repo = Repository::discover(&fixture.path()).unwrap().local();
    assert!(list_stashes(&repo).unwrap().is_empty());
}

#[test]
fn stashes_match_git_stash_list() {
    let fixture = Fixture::new();
    let file = fixture.path().join("file.txt");
    std::fs::write(&file, "one\n").unwrap();
    fixture.git(&["add", "file.txt"]);
    fixture.commit("base");
    std::fs::write(&file, "two\n").unwrap();
    fixture.git(&["stash", "push", "--quiet"]);
    std::fs::write(&file, "three\n").unwrap();
    fixture.git(&["stash", "push", "--quiet", "-m", "second stash"]);

    let repo = Repository::discover(&fixture.path()).unwrap().local();
    let stashes = list_stashes(&repo).unwrap();
    let ours: Vec<String> = stashes
        .iter()
        .map(|stash| format!("stash@{{{}}} {} {}", stash.index, stash.id, stash.message))
        .collect();
    let git: Vec<String> = fixture
        .git(&["stash", "list", "--format=%gd %H %gs"])
        .lines()
        .map(str::to_owned)
        .collect();
    assert_eq!(ours, git);
    assert_eq!(stashes[0].message, "On main: second stash");
    assert_eq!(stashes[0].branch.as_deref(), Some("main"));
    assert!(stashes[1].message.starts_with("WIP on main: "));
}

#[test]
fn each_stash_is_labelled_on_the_commit_it_was_made_on() {
    let fixture = Fixture::new();
    let file = fixture.path().join("file.txt");
    std::fs::write(&file, "one").unwrap();
    fixture.git(&["add", "file.txt"]);
    let first = fixture.commit("first");
    std::fs::write(&file, "stashed on first").unwrap();
    fixture.git(&["stash", "push", "--quiet", "-m", "on first"]);
    let second = fixture.commit("second");
    std::fs::write(&file, "stashed on second").unwrap();
    fixture.git(&["stash", "push", "--quiet", "-m", "on second"]);

    let repo = Repository::discover(&fixture.path()).unwrap().local();
    let bases: Vec<(u32, String, String)> = stash_bases(&repo)
        .unwrap()
        .into_iter()
        .map(|stash| (stash.index, stash.message, stash.base.to_string()))
        .collect();
    assert_eq!(
        bases,
        [
            (0, "On main: on second".to_owned(), second),
            (1, "On main: on first".to_owned(), first),
        ]
    );
}
