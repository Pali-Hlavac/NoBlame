//! File history following renames, checked on a scripted repository: a rename on `main`, an
//! edit under the old name on a side branch, and the merge that brings that edit in.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::collections::HashMap;
use std::fs;

use git_core::cli::Git;
use git_core::history::{FileHistory, PathChange, file_history};
use git_core::repo::Repository;
use support::Fixture;
use tokio_util::sync::CancellationToken;

/// Twenty lines, so a rename with a small edit is still found as a rename.
fn text(first: &str, last: &str) -> String {
    let middle: Vec<String> = (2..20).map(|line| format!("line {line}")).collect();
    format!("{first}\n{}\n{last}\n", middle.join("\n"))
}

struct Commits {
    add: String,
    before: String,
    rename: String,
    side: String,
    merge: String,
    after: String,
}

fn fixture() -> (Fixture, Commits) {
    let fixture = Fixture::new();
    let root = fixture.path();
    fs::write(root.join("notes.txt"), text("one", "end")).unwrap();
    fs::write(root.join("other.txt"), "other\n").unwrap();
    fixture.git(&["add", "."]);
    let add = fixture.commit("add");
    fixture.git(&["branch", "side"]);
    fs::write(root.join("notes.txt"), text("ONE", "end")).unwrap();
    let before = commit_all(&fixture, "edit before the rename");
    fs::create_dir_all(root.join("docs")).unwrap();
    fixture.git(&["mv", "notes.txt", "docs/notes.md"]);
    fs::write(root.join("docs/notes.md"), text("ONE", "end")).unwrap();
    let rename = commit_all(&fixture, "rename");
    fixture.git(&["switch", "--quiet", "side"]);
    fs::write(root.join("notes.txt"), text("one", "END")).unwrap();
    let side = commit_all(&fixture, "edit on the side");
    fixture.git(&["switch", "--quiet", "main"]);
    let merge = fixture.merge("side", "merge side");
    fs::write(root.join("docs/notes.md"), text("ONE!", "END")).unwrap();
    let after = commit_all(&fixture, "edit after the rename");
    let commits = Commits {
        add,
        before,
        rename,
        side,
        merge,
        after,
    };
    (fixture, commits)
}

fn commit_all(fixture: &Fixture, message: &str) -> String {
    fixture.git(&["add", "-A"]);
    fixture.commit(message)
}

async fn history_of(fixture: &Fixture, path: &str, first_parent: bool) -> FileHistory {
    let repo = Repository::discover(&fixture.path()).unwrap();
    let head = repo.local().head_id().unwrap().detach();
    let git = Git::locate().unwrap();
    let cancel = CancellationToken::new();
    let safe = repo.thread_safe();
    file_history(
        &git,
        &fixture.path(),
        &safe,
        &[head],
        first_parent,
        path.into(),
        &cancel,
    )
    .await
    .unwrap()
}

/// Each commit with what it did and the file's name there.
fn by_commit(history: &FileHistory) -> HashMap<String, (PathChange, String)> {
    history
        .entries
        .iter()
        .map(|entry| {
            let path = history.paths[entry.path].to_string();
            (entry.id.to_string(), (entry.change, path))
        })
        .collect()
}

#[tokio::test]
async fn follows_a_rename_and_the_old_name_on_a_merged_branch() {
    let (fixture, c) = fixture();
    let history = history_of(&fixture, "docs/notes.md", false).await;
    let found = by_commit(&history);
    let expect = |id: &str, change: PathChange, path: &str| {
        assert_eq!(found.get(id), Some(&(change, path.to_owned())), "{id}");
    };
    expect(&c.after, PathChange::Modified, "docs/notes.md");
    expect(&c.merge, PathChange::Merge, "docs/notes.md");
    expect(&c.rename, PathChange::Renamed, "docs/notes.md");
    expect(&c.before, PathChange::Modified, "notes.txt");
    expect(&c.side, PathChange::Modified, "notes.txt");
    expect(&c.add, PathChange::Added, "notes.txt");
    assert_eq!(found.len(), 6);
    let rename = history
        .entries
        .iter()
        .find(|entry| entry.id.to_string().as_str() == c.rename.as_str());
    let previous = rename.and_then(|entry| entry.previous).unwrap();
    assert_eq!(history.paths[previous], "notes.txt");
    assert_eq!(history.stopped, None);
}

#[tokio::test]
async fn first_parent_leaves_the_side_branch_out() {
    let (fixture, c) = fixture();
    let found = by_commit(&history_of(&fixture, "docs/notes.md", true).await);
    assert!(!found.contains_key(&c.side));
    assert!(found.contains_key(&c.add));
}

#[tokio::test]
async fn a_folder_is_not_followed() {
    let (fixture, c) = fixture();
    let history = history_of(&fixture, "docs", false).await;
    let found = by_commit(&history);
    assert_eq!(
        found.get(&c.rename).map(|found| found.0),
        Some(PathChange::Added)
    );
    assert!(!found.contains_key(&c.add));
    assert_eq!(history.paths.len(), 1);
}
