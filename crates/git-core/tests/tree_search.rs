//! Searching the files of a revision: matches anywhere in the tree with the folders leading to
//! them, in tree order, ignoring case.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::repo::Repository;
use git_core::tree_search::search_tree;
use support::Fixture;

fn fixture() -> (Fixture, gix::Repository, gix::ObjectId) {
    let fixture = Fixture::new();
    let root = fixture.path();
    fs::create_dir_all(root.join("src/app")).unwrap();
    fs::create_dir_all(root.join("docs")).unwrap();
    fs::write(root.join("README.md"), "r\n").unwrap();
    fs::write(root.join("src/main.rs"), "m\n").unwrap();
    fs::write(root.join("src/app/View.rs"), "v\n").unwrap();
    fs::write(root.join("src/app/model.rs"), "m\n").unwrap();
    fs::write(root.join("docs/view.md"), "d\n").unwrap();
    fixture.git(&["add", "."]);
    fixture.commit("files");
    let repo = Repository::discover(&fixture.path()).unwrap().local();
    let tree = repo.head_commit().unwrap().tree_id().unwrap().detach();
    (fixture, repo, tree)
}

fn rows(search: &git_core::tree_search::TreeSearch) -> Vec<(String, u32, bool)> {
    search
        .rows
        .iter()
        .map(|row| (row.path.to_string(), row.depth, row.matched))
        .collect()
}

#[test]
fn finds_matches_anywhere_with_their_folders_ignoring_case() {
    let (_fixture, repo, tree) = fixture();
    let found = search_tree(&repo, tree, "VIEW").unwrap();
    assert_eq!(
        rows(&found),
        vec![
            ("docs".to_owned(), 0, false),
            ("docs/view.md".to_owned(), 1, true),
            ("src".to_owned(), 0, false),
            ("src/app".to_owned(), 1, false),
            ("src/app/View.rs".to_owned(), 2, true),
        ]
    );
    assert_eq!(found.matches, 2);
    assert!(found.complete);
}

#[test]
fn every_word_must_be_in_the_path() {
    let (_fixture, repo, tree) = fixture();
    let found = search_tree(&repo, tree, "app rs").unwrap();
    let matched: Vec<_> = found
        .rows
        .iter()
        .filter(|row| row.matched)
        .map(|row| row.path.to_string())
        .collect();
    assert_eq!(matched, ["src/app/model.rs", "src/app/View.rs"]);
    assert!(search_tree(&repo, tree, "   ").unwrap().rows.is_empty());
}
