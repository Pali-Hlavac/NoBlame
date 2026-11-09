//! Cherry-picking, reverting and resetting through the real `git`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::operation::{
    OperationError, OperationKind, PickKind, PickOptions, PickOutcome, ResetMode,
    operation_in_progress, pick, reset,
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

fn state(fixture: &Fixture) -> Option<OperationKind> {
    operation_in_progress(&Repository::discover(&fixture.path()).unwrap().local())
        .map(|operation| operation.kind)
}

fn options(kind: PickKind) -> PickOptions {
    PickOptions {
        kind,
        mainline: None,
        no_commit: false,
        record_origin: false,
    }
}

/// `main` changed `a.txt` since `first`; `topic` changed it differently, then added `b.txt`.
fn diverged() -> Fixture {
    let fixture = Fixture::new();
    for (key, value) in [
        ("user.name", "Ada Lovelace"),
        ("user.email", "ada@example.com"),
        ("core.autocrlf", "false"),
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
    fixture.git(&["commit", "-qam", "topic changes a"]);
    fs::write(fixture.path().join("b.txt"), "b\n").unwrap();
    fixture.git(&["add", "b.txt"]);
    fixture.git(&["commit", "-qm", "topic adds b"]);
    fixture.git(&["switch", "-q", "main"]);
    fixture
}

#[tokio::test]
async fn cherry_picks_then_skips_a_pick_that_would_be_empty() {
    let fixture = diverged();
    let dir = fixture.path();
    let with_origin = PickOptions {
        record_origin: true,
        ..options(PickKind::CherryPick)
    };
    let result = pick(&git(), &dir, "topic", with_origin, &cancel())
        .await
        .unwrap();
    assert_eq!(result.outcome, PickOutcome::Committed);
    let message = fixture.git(&["log", "-1", "--format=%B"]);
    assert!(message.starts_with("topic adds b"));
    assert!(message.contains("cherry picked from commit"));

    // The same changes again: nothing to do, and nothing left in progress.
    let head = fixture.git(&["rev-parse", "HEAD"]);
    let again = pick(
        &git(),
        &dir,
        "topic",
        options(PickKind::CherryPick),
        &cancel(),
    )
    .await
    .unwrap();
    assert_eq!(again.outcome, PickOutcome::Empty);
    assert_eq!(state(&fixture), None);
    assert_eq!(fixture.git(&["rev-parse", "HEAD"]), head);
}

#[tokio::test]
async fn stops_on_conflicts_with_the_pick_in_progress() {
    let fixture = diverged();
    let dir = fixture.path();
    let result = pick(
        &git(),
        &dir,
        "topic~1",
        options(PickKind::CherryPick),
        &cancel(),
    )
    .await
    .unwrap();
    assert_eq!(result.outcome, PickOutcome::Conflicts);
    assert_eq!(state(&fixture), Some(OperationKind::CherryPick));

    // Another pick is refused while this one is in progress.
    let busy = pick(
        &git(),
        &dir,
        "topic",
        options(PickKind::CherryPick),
        &cancel(),
    )
    .await;
    assert!(matches!(busy, Err(OperationError::Rejected { .. })));
}

#[tokio::test]
async fn reverts_staged_only_or_committed_and_a_merge_by_its_mainline() {
    let fixture = diverged();
    let dir = fixture.path();
    let staged = PickOptions {
        no_commit: true,
        ..options(PickKind::Revert)
    };
    let result = pick(&git(), &dir, "HEAD", staged, &cancel()).await.unwrap();
    assert_eq!(result.outcome, PickOutcome::Staged);
    assert_eq!(fixture.git(&["diff", "--cached", "--name-only"]), "a.txt");
    fixture.git(&["reset", "-q", "--hard"]);
    // git leaves REVERT_HEAD after `--no-commit`; clear it as committing would.
    fixture.git(&["revert", "--quit"]);

    // A merge commit is reverted against its first parent.
    fixture.git(&["switch", "-q", "-c", "side", "main~1"]);
    fixture.git(&["merge", "-q", "--no-ff", "--no-edit", "topic"]);
    let merged = PickOptions {
        mainline: Some(1),
        ..options(PickKind::Revert)
    };
    let result = pick(&git(), &dir, "HEAD", merged, &cancel()).await.unwrap();
    assert_eq!(result.outcome, PickOutcome::Committed);
    assert_eq!(fixture.git(&["show", "HEAD:a.txt"]), "1");
    assert!(!dir.join("b.txt").exists());
}

#[tokio::test]
async fn resets_softly_hard_or_keeping_local_changes() {
    let fixture = diverged();
    let dir = fixture.path();
    fixture.git(&["switch", "-q", "topic"]);
    reset(&git(), &dir, "topic~2", ResetMode::Soft, &cancel())
        .await
        .unwrap();
    // The changes of both commits left behind are staged.
    assert_eq!(
        fixture.git(&["diff", "--cached", "--name-only"]),
        "a.txt\nb.txt"
    );

    // Keep refuses: a.txt has local changes and the commit changes it.
    fixture.git(&["reset", "-q", "--hard", "topic@{1}"]);
    fs::write(dir.join("a.txt"), "local\n").unwrap();
    let kept = reset(&git(), &dir, "topic~2", ResetMode::Keep, &cancel()).await;
    assert!(matches!(kept, Err(OperationError::Rejected { .. })));

    reset(&git(), &dir, "topic~2", ResetMode::Hard, &cancel())
        .await
        .unwrap();
    assert_eq!(fs::read_to_string(dir.join("a.txt")).unwrap(), "1\n");
    assert_eq!(fixture.git(&["status", "--porcelain"]), "");
}
