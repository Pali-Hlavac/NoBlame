//! Comparing two commits: the files that differ directly and
//! since the merge base (as `git diff A B` and `git diff A...B`), renames, and the commits each
//! side has that the other lacks.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::compare::{AheadBehind, compare_commits, count_ahead_behind, merge_base};
use git_core::diff::{ChangeStatus, parse_object_id};
use git_core::repo::Repository;
use support::Fixture;
use tokio_util::sync::CancellationToken;

/// main: base → main-only; feature (from base): renamed and edited, a new file.
struct Branches {
    fixture: Fixture,
    base: String,
    main: String,
    feature: String,
}

fn branches() -> Branches {
    let fixture = Fixture::new();
    let root = fixture.path();
    let lines: String = (1..=20)
        .map(|n| format!("line {n}"))
        .collect::<Vec<_>>()
        .join("\n")
        + "\n";
    fs::write(root.join("shared.txt"), &lines).unwrap();
    fs::write(root.join("common.txt"), "common\n").unwrap();
    fixture.git(&["add", "."]);
    let base = fixture.commit("base");
    fixture.git(&["branch", "feature"]);
    fs::write(root.join("main-only.txt"), "main\n").unwrap();
    fixture.git(&["add", "."]);
    let main = fixture.commit("main work");
    fixture.git(&["checkout", "-q", "feature"]);
    fixture.git(&["mv", "shared.txt", "moved.txt"]);
    fs::write(root.join("moved.txt"), format!("{lines}line 21\n")).unwrap();
    fs::write(root.join("feature.txt"), "feature\n").unwrap();
    fixture.git(&["add", "."]);
    let feature = fixture.commit("feature work");
    fixture.git(&["checkout", "-q", "main"]);
    Branches {
        fixture,
        base,
        main,
        feature,
    }
}

/// `(status, path, previous path)` of each file, as compared.
async fn compared(
    branches: &Branches,
    since_merge_base: bool,
) -> Vec<(ChangeStatus, String, Option<String>)> {
    let repo = Repository::discover(&branches.fixture.path()).unwrap();
    let (main, feature) = (
        parse_object_id(&branches.main).unwrap(),
        parse_object_id(&branches.feature).unwrap(),
    );
    let comparison = compare_commits(
        &Git::locate().unwrap(),
        &branches.fixture.path(),
        &repo.thread_safe(),
        main,
        feature,
        since_merge_base,
        &CancellationToken::new(),
    )
    .await
    .unwrap();
    let expected_from = if since_merge_base {
        &branches.base
    } else {
        &branches.main
    };
    assert_eq!(comparison.from.to_string(), *expected_from);
    assert_eq!(comparison.total, comparison.files.len());
    comparison
        .files
        .iter()
        .map(|file| {
            (
                file.status,
                file.path.to_string(),
                file.previous_path.as_ref().map(ToString::to_string),
            )
        })
        .collect()
}

#[tokio::test]
async fn compares_two_branches_directly_and_since_they_split() {
    let branches = branches();
    let renamed = (
        ChangeStatus::Renamed,
        "moved.txt".to_owned(),
        Some("shared.txt".to_owned()),
    );
    let added = (ChangeStatus::Added, "feature.txt".to_owned(), None);
    assert_eq!(
        compared(&branches, false).await,
        [
            added.clone(),
            (ChangeStatus::Deleted, "main-only.txt".to_owned(), None),
            renamed.clone(),
        ]
    );
    // Since the merge base, main's own work is not part of the difference.
    assert_eq!(compared(&branches, true).await, [added, renamed]);
}

#[tokio::test]
async fn counts_the_commits_each_side_lacks() {
    let branches = branches();
    let fixture = &branches.fixture;
    fixture.git(&["checkout", "-q", "feature"]);
    fs::write(fixture.path().join("feature.txt"), "more\n").unwrap();
    fixture.git(&["add", "."]);
    let feature = fixture.commit("more feature work");
    let counts = count_ahead_behind(
        &Git::locate().unwrap(),
        &fixture.path(),
        parse_object_id(&branches.main).unwrap(),
        parse_object_id(&feature).unwrap(),
        &CancellationToken::new(),
    )
    .await
    .unwrap();
    assert_eq!(
        counts,
        AheadBehind {
            ahead: 2,
            behind: 1
        }
    );
}

#[test]
fn finds_the_merge_base() {
    let branches = branches();
    let repo = Repository::discover(&branches.fixture.path()).unwrap();
    let base = merge_base(
        &repo.local(),
        parse_object_id(&branches.main).unwrap(),
        parse_object_id(&branches.feature).unwrap(),
    )
    .unwrap();
    assert_eq!(base.to_string(), branches.base);
}

#[tokio::test]
async fn a_partial_clone_finds_only_exact_renames_and_downloads_nothing() {
    let branches = branches();
    let fixture = &branches.fixture;
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
    let repo = Repository::discover(&clone).unwrap();
    let comparison = compare_commits(
        &Git::locate().unwrap(),
        &clone,
        &repo.thread_safe(),
        parse_object_id(&branches.main).unwrap(),
        parse_object_id(&branches.feature).unwrap(),
        false,
        &CancellationToken::new(),
    )
    .await
    .unwrap();
    assert!(comparison.exact_renames_only);
    let statuses: Vec<_> = comparison
        .files
        .iter()
        .map(|file| (file.status, file.path.to_string()))
        .collect();
    // The edited, moved file needs its contents to be paired: deleted and added instead.
    assert_eq!(
        statuses,
        [
            (ChangeStatus::Added, "feature.txt".to_owned()),
            (ChangeStatus::Deleted, "main-only.txt".to_owned()),
            (ChangeStatus::Added, "moved.txt".to_owned()),
            (ChangeStatus::Deleted, "shared.txt".to_owned()),
        ]
    );
}
