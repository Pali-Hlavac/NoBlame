//! The files a commit changed, checked on scripted histories.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::diff::{ChangeStatus, commit_changes};
use git_core::repo::Repository;
use support::Fixture;

fn write(fixture: &Fixture, name: &str, content: &str) {
    let path = fixture.path().join(name);
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).unwrap();
    }
    fs::write(path, content).unwrap();
}

fn changes(fixture: &Fixture, parent: usize) -> Vec<(String, ChangeStatus, Option<String>)> {
    let repo = Repository::discover(&fixture.path()).unwrap().local();
    let head = repo.head_id().unwrap().detach();
    commit_changes(&repo, head, parent)
        .unwrap()
        .files
        .iter()
        .map(|file| {
            let previous = file.previous_path.as_ref().map(ToString::to_string);
            (file.display_path(), file.status, previous)
        })
        .collect()
}

#[test]
fn lists_added_modified_deleted_and_renamed_files() {
    let fixture = Fixture::new();
    let long = "a line that makes rename detection confident\n".repeat(20);
    write(&fixture, "keep.txt", "1\n");
    write(&fixture, "gone.txt", "bye\n");
    write(&fixture, "src/old_name.rs", &long);
    fixture.git(&["add", "."]);
    fixture.commit("base");

    write(&fixture, "keep.txt", "2\n");
    fs::remove_file(fixture.path().join("gone.txt")).unwrap();
    fs::rename(
        fixture.path().join("src/old_name.rs"),
        fixture.path().join("src/new_name.rs"),
    )
    .unwrap();
    write(&fixture, "docs/new.md", "hello\n");
    fixture.git(&["add", "-A"]);
    fixture.commit("change");

    assert_eq!(
        changes(&fixture, 0),
        [
            ("docs/new.md".into(), ChangeStatus::Added, None),
            ("gone.txt".into(), ChangeStatus::Deleted, None),
            ("keep.txt".into(), ChangeStatus::Modified, None),
            (
                "src/new_name.rs".into(),
                ChangeStatus::Renamed,
                Some("src/old_name.rs".into())
            ),
        ]
    );
}

#[test]
fn a_root_commit_adds_everything_and_merges_pick_a_parent() {
    let fixture = Fixture::new();
    write(&fixture, "a.txt", "a\n");
    fixture.git(&["add", "."]);
    fixture.commit("root");
    assert_eq!(
        changes(&fixture, 0),
        [("a.txt".into(), ChangeStatus::Added, None)]
    );

    fixture.git(&["checkout", "--quiet", "-b", "topic"]);
    write(&fixture, "topic.txt", "t\n");
    fixture.git(&["add", "."]);
    fixture.commit("topic");
    fixture.git(&["checkout", "--quiet", "main"]);
    write(&fixture, "main.txt", "m\n");
    fixture.git(&["add", "."]);
    fixture.commit("main");
    fixture.merge("topic", "merge");

    // Against the first parent the merge brings in the topic's file, against the second main's.
    assert_eq!(
        changes(&fixture, 0),
        [("topic.txt".into(), ChangeStatus::Added, None)]
    );
    assert_eq!(
        changes(&fixture, 1),
        [("main.txt".into(), ChangeStatus::Added, None)]
    );
    let repo = Repository::discover(&fixture.path()).unwrap().local();
    let head = repo.head_id().unwrap().detach();
    assert!(commit_changes(&repo, head, 2).is_err());
}
