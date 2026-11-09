//! Rebasing onto another commit, what it would replay, and going on after conflicts, through
//! the real `git`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::operation::{
    OperationError, OperationKind, RebaseOptions, RebaseOutcome, SequenceStep,
    operation_in_progress, rebase, rebase_preview, run_step,
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

fn write(fixture: &Fixture, name: &str, text: &str) {
    fs::write(fixture.path().join(name), text).unwrap();
}

/// `main`: `a.txt` changed, `z.txt` added. `topic`: `x.txt` added, `a.txt` changed
/// differently, `y.txt` added.
fn diverged() -> Fixture {
    let fixture = Fixture::new();
    for (key, value) in [
        ("user.name", "Ada Lovelace"),
        ("user.email", "ada@example.com"),
        ("core.autocrlf", "false"),
    ] {
        fixture.git(&["config", key, value]);
    }
    write(&fixture, "a.txt", "1\n");
    fixture.git(&["add", "a.txt"]);
    fixture.commit("first");
    fixture.git(&["switch", "-q", "-c", "topic"]);
    for (name, text, message) in [
        ("x.txt", "x\n", "topic adds x"),
        ("a.txt", "topic\n", "topic changes a"),
        ("y.txt", "y\n", "topic adds y"),
    ] {
        write(&fixture, name, text);
        fixture.git(&["add", name]);
        fixture.git(&["commit", "-qm", message]);
    }
    fixture.git(&["switch", "-q", "main"]);
    write(&fixture, "a.txt", "main\n");
    write(&fixture, "z.txt", "z\n");
    fixture.git(&["add", "."]);
    fixture.git(&["commit", "-qm", "main changes a, adds z"]);
    fixture
}

#[tokio::test]
async fn previews_then_rebases_through_a_conflict() {
    let fixture = diverged();
    let dir = fixture.path();
    // The first two topic commits were pushed.
    fixture.git(&["update-ref", "refs/remotes/origin/topic", "topic~1"]);
    fixture.git(&["switch", "-q", "topic"]);
    let preview = rebase_preview(&git(), &dir, "main", &cancel())
        .await
        .unwrap();
    assert_eq!(preview.replayed.count, 3);
    assert_eq!(preview.replayed.newest[0].1, "topic adds y");
    assert_eq!(preview.published, 2);

    let result = rebase(&git(), &dir, "main", RebaseOptions::default(), &cancel())
        .await
        .unwrap();
    assert_eq!(result.outcome, RebaseOutcome::Conflicts);
    let operation = state(&fixture).unwrap();
    assert_eq!(operation.kind, OperationKind::Rebase);
    assert_eq!(operation.step, Some((2, 3)));

    write(&fixture, "a.txt", "both\n");
    fixture.git(&["add", "a.txt"]);
    let step = run_step(
        &git(),
        &dir,
        OperationKind::Rebase,
        SequenceStep::Continue,
        &cancel(),
    )
    .await
    .unwrap();
    assert!(!step.conflicts);
    assert_eq!(state(&fixture), None);
    assert_eq!(
        fixture.git(&["log", "--format=%s", "main..topic"]),
        "topic adds y\ntopic changes a\ntopic adds x"
    );
    assert_eq!(
        fixture.git(&["merge-base", "main", "topic"]),
        fixture.git(&["rev-parse", "main"])
    );

    // Now nothing is left to replay.
    let again = rebase(&git(), &dir, "main", RebaseOptions::default(), &cancel())
        .await
        .unwrap();
    assert_eq!(again.outcome, RebaseOutcome::UpToDate);
}

#[tokio::test]
async fn continuing_can_stop_at_the_next_conflict() {
    let fixture = diverged();
    let dir = fixture.path();
    fixture.git(&["switch", "-q", "-c", "twice", "main~1"]);
    for text in ["t1\n", "t2\n"] {
        write(&fixture, "a.txt", text);
        fixture.git(&["commit", "-qam", text.trim()]);
    }
    let result = rebase(&git(), &dir, "main", RebaseOptions::default(), &cancel())
        .await
        .unwrap();
    assert_eq!(result.outcome, RebaseOutcome::Conflicts);
    write(&fixture, "a.txt", "resolved\n");
    fixture.git(&["add", "a.txt"]);
    let step = run_step(
        &git(),
        &dir,
        OperationKind::Rebase,
        SequenceStep::Continue,
        &cancel(),
    )
    .await
    .unwrap();
    assert!(step.conflicts);
    assert_eq!(state(&fixture).unwrap().step, Some((2, 2)));
}

#[tokio::test]
async fn refuses_local_changes_unless_they_are_stashed_meanwhile() {
    let fixture = diverged();
    let dir = fixture.path();
    fixture.git(&["switch", "-q", "-c", "behind", "main~1"]);
    write(&fixture, "x.txt", "local\n");
    fixture.git(&["add", "x.txt"]);
    let refused = rebase(&git(), &dir, "main", RebaseOptions::default(), &cancel()).await;
    assert!(matches!(refused, Err(OperationError::Rejected { .. })));

    let stashed = RebaseOptions {
        autostash: true,
        ..RebaseOptions::default()
    };
    let result = rebase(&git(), &dir, "main", stashed, &cancel())
        .await
        .unwrap();
    assert_eq!(result.outcome, RebaseOutcome::Rebased);
    assert_eq!(
        fixture.git(&["rev-parse", "HEAD"]),
        fixture.git(&["rev-parse", "main"])
    );
    assert_eq!(fs::read_to_string(dir.join("x.txt")).unwrap(), "local\n");
}
