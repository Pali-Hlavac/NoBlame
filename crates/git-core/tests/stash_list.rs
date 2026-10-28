//! Reading the stash list with gix, checked against `git stash list`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use git_core::repo::Repository;
use git_core::stash::list_stashes;
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
