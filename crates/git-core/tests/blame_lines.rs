//! Blame through the user's git: each line's commit across a rename, the version before a
//! change ("blame the previous revision"), and a path the commit does not have.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::blame::{Blame, blame};
use git_core::cli::Git;
use git_core::diff::parse_object_id;
use support::Fixture;
use tokio_util::sync::CancellationToken;

/// The commit each line (1-based) comes from, as `(id, path there)`.
fn line_origins(blame: &Blame) -> Vec<(String, String)> {
    let mut origins = Vec::new();
    for hunk in &blame.hunks {
        assert_eq!(
            hunk.line as usize,
            origins.len() + 1,
            "hunks cover every line in order"
        );
        for _ in 0..hunk.count {
            let commit = &blame.commits[hunk.commit];
            origins.push((commit.id.to_string(), blame.paths[hunk.path].to_string()));
        }
    }
    origins
}

async fn blame_at(fixture: &Fixture, commit: &str, path: &str) -> Blame {
    let git = Git::locate().unwrap();
    let id = parse_object_id(commit).unwrap();
    blame(
        &git,
        &fixture.path(),
        id,
        path.into(),
        &CancellationToken::new(),
    )
    .await
    .unwrap()
}

#[tokio::test]
async fn follows_lines_across_a_rename_and_names_the_previous_version() {
    let fixture = Fixture::new();
    let root = fixture.path();
    let body = |two: &str, four: &str| format!("one\n{two}\nthree\n{four}\nfive\nsix\n");
    fs::write(root.join("old.txt"), body("two", "four")).unwrap();
    fixture.git(&["add", "."]);
    let add = fixture.commit("add");
    fs::write(root.join("old.txt"), body("TWO", "four")).unwrap();
    fixture.git(&["add", "."]);
    let edit = fixture.commit("edit line two");
    fixture.git(&["mv", "old.txt", "new.txt"]);
    fs::write(root.join("new.txt"), body("TWO", "FOUR")).unwrap();
    fixture.git(&["add", "."]);
    let rename = fixture.commit("rename and edit line four");

    let blame = blame_at(&fixture, &rename, "new.txt").await;
    let origins = line_origins(&blame);
    assert_eq!(origins.len(), 6);
    assert_eq!(origins[0], (add.clone(), "old.txt".to_owned()));
    assert_eq!(origins[1], (edit.clone(), "old.txt".to_owned()));
    assert_eq!(origins[3], (rename.clone(), "new.txt".to_owned()));

    let renamed = blame
        .commits
        .iter()
        .find(|commit| commit.id.to_string().as_str() == rename.as_str());
    let previous = renamed.and_then(|commit| commit.previous.clone()).unwrap();
    assert_eq!(previous.0.to_string(), edit);
    assert_eq!(previous.1, "old.txt");
    let added = blame
        .commits
        .iter()
        .find(|commit| commit.id.to_string().as_str() == add.as_str());
    assert_eq!(added.and_then(|commit| commit.previous.clone()), None);
    assert_eq!(added.map(|commit| commit.summary.as_str()), Some("add"));
    assert_eq!(
        added.map(|commit| commit.author_name.as_str()),
        Some("Ada Lovelace")
    );

    // The version before the rename, as "blame the previous revision" asks for it.
    let before = blame_at(&fixture, &edit, "old.txt").await;
    assert_eq!(line_origins(&before)[3], (add, "old.txt".to_owned()));
}

#[tokio::test]
async fn a_path_the_commit_does_not_have_is_an_error() {
    let fixture = Fixture::new();
    fs::write(fixture.path().join("a.txt"), "a\n").unwrap();
    fixture.git(&["add", "."]);
    let commit = parse_object_id(&fixture.commit("add")).unwrap();
    let git = Git::locate().unwrap();
    let (dir, cancel) = (fixture.path(), CancellationToken::new());
    assert!(
        blame(&git, &dir, commit, "b.txt".into(), &cancel)
            .await
            .is_err()
    );
}
