//! The working tree status summary, read through the real `git`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::status::{StatusSummary, status_summary};
use support::Fixture;
use tokio_util::sync::CancellationToken;

async fn summary(fixture: &Fixture) -> StatusSummary {
    let git = Git::locate().expect("tests need git on PATH");
    status_summary(&git, &fixture.path(), &CancellationToken::new())
        .await
        .unwrap()
}

fn write(fixture: &Fixture, name: &str, content: &str) {
    fs::write(fixture.path().join(name), content).unwrap();
}

#[tokio::test]
async fn counts_staged_changed_and_untracked_files() {
    let fixture = Fixture::new();
    write(&fixture, "a.txt", "a\n");
    write(&fixture, "b.txt", "b\n");
    fixture.git(&["add", "a.txt", "b.txt"]);
    fixture.commit("base");
    assert!(summary(&fixture).await.is_clean());

    write(&fixture, "a.txt", "a2\n");
    fixture.git(&["add", "a.txt"]);
    write(&fixture, "a.txt", "a3\n"); // staged and changed again
    write(&fixture, "b.txt", "b2\n");
    fs::create_dir(fixture.path().join("new")).unwrap();
    write(&fixture, "new/one.txt", "1\n");
    write(&fixture, "new/two.txt", "2\n");
    write(&fixture, "loose.txt", "x\n");

    assert_eq!(
        summary(&fixture).await,
        StatusSummary {
            staged: 1,
            unstaged: 2,
            untracked: 2, // `new/` counts once, as git lists it
            conflicted: 0
        }
    );
}

#[tokio::test]
async fn counts_conflicts() {
    let fixture = Fixture::new();
    write(&fixture, "c.txt", "base\n");
    fixture.git(&["add", "c.txt"]);
    fixture.commit("base");
    fixture.git(&["checkout", "--quiet", "-b", "topic"]);
    write(&fixture, "c.txt", "topic\n");
    fixture.git(&["commit", "--quiet", "-am", "topic"]);
    fixture.git(&["checkout", "--quiet", "main"]);
    write(&fixture, "c.txt", "main\n");
    fixture.git(&["commit", "--quiet", "-am", "main"]);
    // The merge stops on the conflict; the fixture's `git` helper would fail on that exit code.
    let merge = std::process::Command::new("git")
        .args(["merge", "--quiet", "topic"])
        .current_dir(fixture.path())
        .output()
        .unwrap();
    assert!(!merge.status.success());

    let counts = summary(&fixture).await;
    assert_eq!(counts.conflicted, 1);
    assert!(!counts.is_clean());
}
