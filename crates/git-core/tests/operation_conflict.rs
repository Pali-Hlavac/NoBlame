//! The conflicted files, taking a side, and the external merge tool, through the real `git`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::operation::{
    ConflictKind, MergeMode, MergeToolOutcome, OperationError, Side, conflicts, merge,
    run_merge_tool, take_side,
};
use gix::bstr::BString;
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn git() -> Git {
    Git::locate().expect("tests need git on PATH")
}

fn cancel() -> CancellationToken {
    CancellationToken::new()
}

/// A merge of `topic` into `main` stopped with three conflicts: `both.txt` changed on both
/// sides, `ours-gone.txt` deleted on main and changed on topic, `theirs-gone.txt` the other way.
async fn conflicted() -> Fixture {
    let fixture = Fixture::new();
    for (key, value) in [
        ("user.name", "Ada Lovelace"),
        ("user.email", "ada@example.com"),
        ("core.autocrlf", "false"),
        ("mergetool.keepBackup", "false"),
    ] {
        fixture.git(&["config", key, value]);
    }
    let dir = fixture.path();
    for name in ["both.txt", "ours-gone.txt", "theirs-gone.txt"] {
        fs::write(dir.join(name), "1\n").unwrap();
    }
    fixture.git(&["add", "."]);
    fixture.commit("first");
    fixture.git(&["switch", "-q", "-c", "topic"]);
    fs::write(dir.join("both.txt"), "topic\n").unwrap();
    fs::write(dir.join("ours-gone.txt"), "topic\n").unwrap();
    fixture.git(&["rm", "-q", "theirs-gone.txt"]);
    fixture.git(&["commit", "-qam", "topic"]);
    fixture.git(&["switch", "-q", "main"]);
    fs::write(dir.join("both.txt"), "main\n").unwrap();
    fs::write(dir.join("theirs-gone.txt"), "main\n").unwrap();
    fixture.git(&["rm", "-q", "ours-gone.txt"]);
    fixture.git(&["commit", "-qam", "main"]);
    merge(&git(), &dir, "topic", MergeMode::Default, &cancel())
        .await
        .unwrap();
    fixture
}

#[tokio::test]
async fn lists_conflicts_and_takes_a_side() {
    let fixture = conflicted().await;
    let dir = fixture.path();
    let found = conflicts(&git(), &dir, &cancel()).await.unwrap();
    let kinds: Vec<_> = found
        .iter()
        .map(|conflict| (conflict.path.to_string(), conflict.kind))
        .collect();
    assert_eq!(
        kinds,
        vec![
            ("both.txt".to_owned(), ConflictKind::BothModified),
            ("ours-gone.txt".to_owned(), ConflictKind::DeletedByUs),
            ("theirs-gone.txt".to_owned(), ConflictKind::DeletedByThem),
        ]
    );

    // Theirs for the changed file and the one main deleted; ours where topic deleted it, which
    // keeps main's file.
    let theirs = [BString::from("both.txt"), BString::from("ours-gone.txt")];
    take_side(&git(), &dir, &theirs, Side::Theirs, &cancel())
        .await
        .unwrap();
    take_side(
        &git(),
        &dir,
        &[BString::from("theirs-gone.txt")],
        Side::Ours,
        &cancel(),
    )
    .await
    .unwrap();
    assert!(conflicts(&git(), &dir, &cancel()).await.unwrap().is_empty());
    assert_eq!(fs::read_to_string(dir.join("both.txt")).unwrap(), "topic\n");
    assert_eq!(
        fs::read_to_string(dir.join("ours-gone.txt")).unwrap(),
        "topic\n"
    );
    assert_eq!(
        fs::read_to_string(dir.join("theirs-gone.txt")).unwrap(),
        "main\n"
    );

    // Nothing conflicts any more.
    let again = take_side(&git(), &dir, &theirs, Side::Ours, &cancel()).await;
    assert!(matches!(again, Err(OperationError::NotApplicable(_))));
}

#[tokio::test]
async fn takes_the_deleting_side_by_removing_the_file() {
    let fixture = conflicted().await;
    let dir = fixture.path();
    take_side(
        &git(),
        &dir,
        &[BString::from("ours-gone.txt")],
        Side::Ours,
        &cancel(),
    )
    .await
    .unwrap();
    assert!(!dir.join("ours-gone.txt").exists());
    assert_eq!(conflicts(&git(), &dir, &cancel()).await.unwrap().len(), 2);
}

#[tokio::test]
async fn runs_the_merge_tool_and_reports_how_it_ended() {
    let fixture = conflicted().await;
    let dir = fixture.path();
    fixture.git(&["config", "mergetool.closes.cmd", "true"]);
    fixture.git(&[
        "config",
        "mergetool.resolves.cmd",
        "printf 'merged\\n' > \"$MERGED\"",
    ]);
    fixture.git(&["config", "mergetool.resolves.trustExitCode", "true"]);
    let path = b"both.txt".as_slice();

    let closed = run_merge_tool(&git(), &dir, "closes", path, &cancel())
        .await
        .unwrap();
    assert!(matches!(closed, MergeToolOutcome::NotResolved { .. }));
    let unknown = run_merge_tool(&git(), &dir, "nosuchtool", path, &cancel()).await;
    assert!(matches!(unknown, Err(OperationError::Rejected { .. })));

    let resolved = run_merge_tool(&git(), &dir, "resolves", path, &cancel())
        .await
        .unwrap();
    assert_eq!(resolved, MergeToolOutcome::Resolved);
    assert_eq!(
        fs::read_to_string(dir.join("both.txt")).unwrap(),
        "merged\n"
    );
    assert_eq!(conflicts(&git(), &dir, &cancel()).await.unwrap().len(), 2);
    // Resolved files are not offered again.
    let done = run_merge_tool(&git(), &dir, "resolves", path, &cancel()).await;
    assert!(matches!(done, Err(OperationError::NotApplicable(_))));
}
