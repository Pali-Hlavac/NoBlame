//! What a folder is before `git init` or `git clone` puts a repository there.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use git_core::repo::{FolderKind, folder_state};
use support::Fixture;

#[test]
fn tells_missing_empty_filled_and_files_apart_outside_repositories() {
    let dir = tempfile::tempdir().unwrap();
    let missing = dir.path().join("new").join("deeper");
    let state = folder_state(&missing);
    assert_eq!(state.kind, FolderKind::Missing);
    assert_eq!(state.repository, None);
    assert!(!state.is_repository);

    let empty = dir.path().join("empty");
    std::fs::create_dir(&empty).unwrap();
    assert_eq!(folder_state(&empty).kind, FolderKind::Empty);

    let file = empty.join("notes.txt");
    std::fs::write(&file, "x").unwrap();
    assert_eq!(folder_state(&empty).kind, FolderKind::Filled);
    assert_eq!(folder_state(&file).kind, FolderKind::File);
}

#[test]
fn names_the_repository_a_folder_is_in() {
    let fixture = Fixture::new();
    fixture.commit("first");
    let top = folder_state(&fixture.path());
    assert_eq!(top.kind, FolderKind::Filled);
    assert!(top.is_repository);
    assert!(top.repository.unwrap().ends_with("repo"));

    // A folder not created yet would be nested in it.
    let nested = folder_state(&fixture.path().join("vendor").join("lib"));
    assert_eq!(nested.kind, FolderKind::Missing);
    assert!(!nested.is_repository);
    assert!(nested.repository.unwrap().ends_with("repo"));
}

#[test]
fn a_bare_repository_is_named_by_its_folder() {
    let fixture = Fixture::bare();
    let state = folder_state(&fixture.path());
    assert!(state.is_repository);
    assert!(state.repository.unwrap().ends_with("repo"));
}
