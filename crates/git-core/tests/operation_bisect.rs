//! Bisecting through the real `git`: marks, the commit tested, the first bad commit.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use git_core::cli::Git;
use git_core::operation::{BisectMark, BisectOutcome, bisect_mark, bisect_state, bisecting};
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn git() -> Git {
    Git::locate().expect("tests need git on PATH")
}

/// The problem arrives with this commit (0-based).
const FIRST_BAD: usize = 5;

#[tokio::test]
async fn bisect_finds_the_first_bad_commit() {
    let fixture = Fixture::new();
    let ids: Vec<String> = (0..10).map(|n| fixture.commit(&format!("c{n}"))).collect();
    let (dir, git_dir, cancel) = (
        fixture.path(),
        fixture.path().join(".git"),
        CancellationToken::new(),
    );
    assert!(!bisecting(&git_dir));
    assert!(
        bisect_mark(&git(), &dir, &git_dir, BisectMark::Skip, None, &cancel)
            .await
            .is_err()
    );

    let (outcome, _) = bisect_mark(&git(), &dir, &git_dir, BisectMark::Bad, None, &cancel)
        .await
        .unwrap();
    assert_eq!(outcome, BisectOutcome::Waiting);
    assert!(bisecting(&git_dir));
    let (mut outcome, _) = bisect_mark(
        &git(),
        &dir,
        &git_dir,
        BisectMark::Good,
        Some(&ids[0]),
        &cancel,
    )
    .await
    .unwrap();
    let state = bisect_state(&git(), &dir, &git_dir, &cancel)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(state.bad.as_deref(), Some(ids[9].as_str()));
    assert_eq!(state.good, vec![ids[0].clone()]);
    assert_eq!(state.started_from.as_deref(), Some("main"));
    let testing = state.testing.unwrap();
    assert_eq!(testing.id, fixture.git(&["rev-parse", "HEAD"]));

    if let BisectOutcome::Testing {
        commit, remaining, ..
    } = &outcome
    {
        assert_eq!(*commit, fixture.git(&["rev-parse", "HEAD"]));
        assert!(*remaining > 0);
    } else {
        panic!("expected a commit to test");
    }
    let mut marks = 0;
    while let BisectOutcome::Testing { .. } = outcome {
        let head = fixture.git(&["rev-parse", "HEAD"]);
        let position = ids.iter().position(|id| *id == head).unwrap();
        let mark = if position >= FIRST_BAD {
            BisectMark::Bad
        } else {
            BisectMark::Good
        };
        outcome = bisect_mark(&git(), &dir, &git_dir, mark, None, &cancel)
            .await
            .unwrap()
            .0;
        marks += 1;
        assert!(marks < 10, "bisect does not end");
    }
    assert_eq!(
        outcome,
        BisectOutcome::Found {
            commit: ids[FIRST_BAD].clone()
        }
    );
    let state = bisect_state(&git(), &dir, &git_dir, &cancel)
        .await
        .unwrap()
        .unwrap();
    let first_bad = state.first_bad.unwrap();
    assert_eq!(first_bad.id, ids[FIRST_BAD]);
    assert_eq!(first_bad.summary, format!("c{FIRST_BAD}"));
    assert!(state.testing.is_none());
}
