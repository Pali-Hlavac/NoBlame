//! Merging, the operation left in progress by conflicts, and going on with or aborting it,
//! through the real `git`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::operation::{
    MergeMode, MergeOutcome, OperationError, OperationKind, SequenceStep, merge, merge_name,
    operation_in_progress, run_step,
};
use git_core::repo::Repository;
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn git() -> Git {
    Git::locate().expect("tests need git on PATH")
}

fn cancel() -> CancellationToken {
    CancellationToken::new()
}

fn state(fixture: &Fixture) -> Option<git_core::operation::Operation> {
    operation_in_progress(&Repository::discover(&fixture.path()).unwrap().local())
}

/// `main` and `topic` both changed `a.txt` since `first`; `topic` also added `b.txt`.
fn diverged() -> Fixture {
    let fixture = Fixture::new();
    for (key, value) in [
        ("user.name", "Ada Lovelace"),
        ("user.email", "ada@example.com"),
        ("core.autocrlf", "false"),
        ("merge.ff", "true"),
    ] {
        fixture.git(&["config", key, value]);
    }
    fs::write(fixture.path().join("a.txt"), "1\n").unwrap();
    fixture.git(&["add", "a.txt"]);
    fixture.commit("first");
    fixture.git(&["branch", "topic"]);
    fs::write(fixture.path().join("a.txt"), "main\n").unwrap();
    fixture.git(&["commit", "-qam", "main changes a"]);
    fixture.git(&["switch", "-q", "topic"]);
    fs::write(fixture.path().join("a.txt"), "topic\n").unwrap();
    fs::write(fixture.path().join("b.txt"), "b\n").unwrap();
    fixture.git(&["add", "."]);
    fixture.git(&["commit", "-qm", "topic changes a"]);
    fixture.git(&["switch", "-q", "main"]);
    fixture
}

#[tokio::test]
async fn fast_forwards_and_says_when_there_is_nothing_to_merge() {
    let fixture = diverged();
    fixture.git(&["branch", "behind", "main~1"]);
    fixture.git(&["switch", "-q", "behind"]);
    let dir = fixture.path();
    let result = merge(&git(), &dir, "main", MergeMode::Default, &cancel())
        .await
        .unwrap();
    assert_eq!(result.outcome, MergeOutcome::FastForwarded);
    let again = merge(&git(), &dir, "main", MergeMode::Default, &cancel())
        .await
        .unwrap();
    assert_eq!(again.outcome, MergeOutcome::UpToDate);
    // Only a fast-forward was allowed, and the histories diverged.
    let refused = merge(&git(), &dir, "topic", MergeMode::FastForwardOnly, &cancel()).await;
    assert!(matches!(refused, Err(OperationError::Rejected { .. })));
    assert_eq!(state(&fixture), None);
}

#[tokio::test]
async fn stops_on_conflicts_then_aborts_or_continues() {
    let fixture = diverged();
    let dir = fixture.path();
    let head = fixture.git(&["rev-parse", "HEAD"]);
    let result = merge(&git(), &dir, "topic", MergeMode::NoFastForward, &cancel())
        .await
        .unwrap();
    assert_eq!(result.outcome, MergeOutcome::Conflicts);
    let operation = state(&fixture).unwrap();
    assert_eq!(operation.kind, OperationKind::Merge);
    assert_eq!(operation.detail.as_deref(), Some("Merge branch 'topic'"));

    // Continuing with the conflict unresolved is refused; skipping does not apply to a merge.
    let early = run_step(
        &git(),
        &dir,
        OperationKind::Merge,
        SequenceStep::Continue,
        &cancel(),
    )
    .await;
    assert!(matches!(early, Err(OperationError::Rejected { .. })));
    let skip = run_step(
        &git(),
        &dir,
        OperationKind::Merge,
        SequenceStep::Skip,
        &cancel(),
    )
    .await;
    assert!(matches!(skip, Err(OperationError::NotApplicable(_))));

    run_step(
        &git(),
        &dir,
        OperationKind::Merge,
        SequenceStep::Abort,
        &cancel(),
    )
    .await
    .unwrap();
    assert_eq!(state(&fixture), None);
    assert_eq!(fixture.git(&["rev-parse", "HEAD"]), head);

    // Again, resolved this time: Continue commits the merge with git's message.
    merge(&git(), &dir, "topic", MergeMode::Default, &cancel())
        .await
        .unwrap();
    fs::write(dir.join("a.txt"), "both\n").unwrap();
    fixture.git(&["add", "a.txt"]);
    run_step(
        &git(),
        &dir,
        OperationKind::Merge,
        SequenceStep::Continue,
        &cancel(),
    )
    .await
    .unwrap();
    assert_eq!(state(&fixture), None);
    assert_eq!(
        fixture
            .git(&["log", "-1", "--format=%P"])
            .split(' ')
            .count(),
        2
    );
    assert_eq!(
        fixture.git(&["log", "-1", "--format=%s"]),
        "Merge branch 'topic'"
    );
}

#[tokio::test]
async fn squashes_without_committing() {
    let fixture = diverged();
    fixture.git(&["switch", "-q", "-c", "clean", "main~1"]);
    let dir = fixture.path();
    let result = merge(&git(), &dir, "topic", MergeMode::Squash, &cancel())
        .await
        .unwrap();
    assert_eq!(result.outcome, MergeOutcome::Squashed);
    // Staged, not committed, and no merge in progress.
    assert_eq!(
        fixture.git(&["diff", "--cached", "--name-only"]),
        "a.txt\nb.txt"
    );
    assert_eq!(state(&fixture), None);
}

#[test]
fn merges_by_the_short_name_unless_it_is_ambiguous() {
    let fixture = diverged();
    fixture.git(&["tag", "v1"]);
    fixture.git(&["tag", "topic", "main~1"]);
    let repo = Repository::discover(&fixture.path()).unwrap().local();
    assert_eq!(merge_name(&repo, "refs/tags/v1"), "v1");
    assert_eq!(merge_name(&repo, "refs/heads/main"), "main");
    // `topic` is a branch and a tag: only the full name says which.
    assert_eq!(merge_name(&repo, "refs/heads/topic"), "refs/heads/topic");
    assert_eq!(merge_name(&repo, "a1b2c3d4"), "a1b2c3d4");
}
