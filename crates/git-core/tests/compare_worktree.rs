//! Comparing a commit with the working tree (as `git diff <commit>`): edited, staged, deleted
//! and untracked files, since the merge base, and a partial clone that must not download.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;
use std::path::Path;

use git_core::cli::Git;
use git_core::compare::{Comparison, compare_with_worktree};
use git_core::diff::{ChangeStatus, parse_object_id};
use git_core::repo::Repository;
use support::Fixture;
use tokio_util::sync::CancellationToken;

/// main: base → main-only.txt; feature (from base): a new file. HEAD is on `head`.
fn branches(head: &str) -> (Fixture, String, String) {
    let fixture = Fixture::new();
    let root = fixture.path();
    fs::write(root.join("shared.txt"), "one\ntwo\nthree\n").unwrap();
    fs::write(root.join("common.txt"), "common\n").unwrap();
    fixture.git(&["add", "."]);
    fixture.commit("base");
    fixture.git(&["branch", "feature"]);
    fs::write(root.join("main-only.txt"), "main\n").unwrap();
    fixture.git(&["add", "."]);
    let main = fixture.commit("main work");
    fixture.git(&["checkout", "-q", "feature"]);
    fs::write(root.join("feature.txt"), "feature\n").unwrap();
    fixture.git(&["add", "."]);
    let feature = fixture.commit("feature work");
    fixture.git(&["checkout", "-q", head]);
    (fixture, main, feature)
}

async fn compare(dir: &Path, base: &str, head: &str, since_merge_base: bool) -> Comparison {
    let repo = Repository::discover(dir).unwrap();
    compare_with_worktree(
        &Git::locate().unwrap(),
        dir,
        &repo.thread_safe(),
        parse_object_id(base).unwrap(),
        parse_object_id(head).unwrap(),
        since_merge_base,
        &CancellationToken::new(),
    )
    .await
    .unwrap()
}

/// `(status, path)` of each file; no new side has an id (the file on disk is read).
fn summary(comparison: &Comparison) -> Vec<(ChangeStatus, String)> {
    assert!(comparison.files.iter().all(|file| file.new_id.is_none()));
    comparison
        .files
        .iter()
        .map(|file| (file.status, file.path.to_string()))
        .collect()
}

#[tokio::test]
async fn lists_tracked_changes_on_disk_and_in_the_index() {
    let (fixture, main, _) = branches("main");
    let root = fixture.path();
    fs::write(root.join("shared.txt"), "one\ntwo\nthree\nfour\n").unwrap();
    fs::write(root.join("staged.txt"), "staged\n").unwrap();
    fixture.git(&["add", "staged.txt"]);
    fs::remove_file(root.join("common.txt")).unwrap();
    fs::write(root.join("untracked.txt"), "not listed\n").unwrap();

    let comparison = compare(&root, &main, &main, false).await;
    assert_eq!(comparison.from.to_string(), main);
    assert!(!comparison.exact_renames_only);
    assert_eq!(
        summary(&comparison),
        [
            (ChangeStatus::Deleted, "common.txt".to_owned()),
            (ChangeStatus::Modified, "shared.txt".to_owned()),
            (ChangeStatus::Added, "staged.txt".to_owned()),
        ]
    );
}

#[tokio::test]
async fn since_the_merge_base_leaves_the_other_branch_out() {
    let (fixture, main, feature) = branches("feature");
    let root = fixture.path();
    fs::write(root.join("feature.txt"), "feature\nmore\n").unwrap();

    let direct = compare(&root, &main, &feature, false).await;
    assert_eq!(
        summary(&direct),
        [
            (ChangeStatus::Added, "feature.txt".to_owned()),
            (ChangeStatus::Deleted, "main-only.txt".to_owned()),
        ]
    );
    let since = compare(&root, &main, &feature, true).await;
    assert_ne!(since.from.to_string(), main);
    assert_eq!(
        summary(&since),
        [(ChangeStatus::Added, "feature.txt".to_owned())]
    );
}

#[tokio::test]
async fn a_partial_clone_finds_only_exact_renames_and_downloads_nothing() {
    let (fixture, main, feature) = branches("main");
    fixture.git(&["config", "uploadpack.allowFilter", "true"]);
    // file:///C:/... on Windows, file:///tmp/... elsewhere.
    let path = fixture.path().display().to_string().replace('\\', "/");
    let source = format!("file:///{}", path.trim_start_matches('/'));
    let clone = fixture.sibling("partial");
    fixture.run(
        &fixture.sibling(""),
        &[
            "clone",
            "--quiet",
            "--filter=blob:none",
            "--no-checkout",
            &source,
            "partial",
        ],
    );
    // Checking out downloads the feature's files only; main-only.txt stays missing.
    fixture.run(&clone, &["checkout", "-q", &feature]);
    fixture.run(&clone, &["mv", "common.txt", "renamed.txt"]);
    fs::write(clone.join("shared.txt"), "edited\n").unwrap();

    let comparison = compare(&clone, &main, &feature, false).await;
    assert!(comparison.exact_renames_only);
    let renamed = comparison
        .files
        .iter()
        .find(|file| file.status == ChangeStatus::Renamed)
        .unwrap();
    assert_eq!(renamed.path.to_string(), "renamed.txt");
    assert_eq!(
        summary(&comparison)
            .into_iter()
            .filter(|(status, ..)| *status != ChangeStatus::Renamed)
            .collect::<Vec<_>>(),
        [
            (ChangeStatus::Added, "feature.txt".to_owned()),
            (ChangeStatus::Deleted, "main-only.txt".to_owned()),
            (ChangeStatus::Modified, "shared.txt".to_owned()),
        ]
    );
}
