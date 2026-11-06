//! Upstreams of local branches: listing, counting ahead and behind, setting and unsetting,
//! through the real `git`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::branch::{
    BranchUpstream, Tracking, ahead_behind, set_upstream, unset_upstream, upstreams,
};
use git_core::cli::Git;
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn git() -> Git {
    Git::locate().expect("tests need git on PATH")
}

fn cancel() -> CancellationToken {
    CancellationToken::new()
}

fn commit_file(fixture: &Fixture, text: &str) {
    fs::write(fixture.path().join("a.txt"), text).unwrap();
    fixture.git(&["add", "a.txt"]);
    fixture.commit(text.trim());
}

/// `main` two commits ahead and one behind `origin/main` (made with `update-ref`, with a
/// remote `origin` whose fetch refspec maps it), and `old` tracking a remote branch that is
/// gone.
fn diverged() -> Fixture {
    let fixture = Fixture::new();
    fixture.git(&["config", "core.autocrlf", "false"]);
    fixture.git(&["config", "remote.origin.url", "/nowhere"]);
    fixture.git(&[
        "config",
        "remote.origin.fetch",
        "+refs/heads/*:refs/remotes/origin/*",
    ]);
    commit_file(&fixture, "base\n");
    fixture.git(&["branch", "old"]);
    fixture.git(&["switch", "--quiet", "--create", "remote-side"]);
    commit_file(&fixture, "theirs\n");
    fixture.git(&["update-ref", "refs/remotes/origin/main", "HEAD"]);
    fixture.git(&["update-ref", "refs/remotes/origin/old", "HEAD"]);
    fixture.git(&["switch", "--quiet", "main"]);
    fixture.git(&["branch", "--quiet", "--delete", "--force", "remote-side"]);
    commit_file(&fixture, "ours 1\n");
    commit_file(&fixture, "ours 2\n");
    fixture.git(&["branch", "--set-upstream-to=origin/main", "main"]);
    fixture.git(&["branch", "--set-upstream-to=origin/old", "old"]);
    fixture.git(&["update-ref", "-d", "refs/remotes/origin/old"]);
    fixture
}

#[tokio::test]
async fn lists_upstreams_and_marks_gone_ones() {
    let fixture = diverged();
    fixture.git(&["branch", "solo"]);
    let listed = upstreams(&git(), &fixture.path(), &cancel()).await.unwrap();
    assert_eq!(
        listed,
        vec![
            BranchUpstream {
                branch: "main".into(),
                upstream: "refs/remotes/origin/main".into(),
                gone: false,
            },
            BranchUpstream {
                branch: "old".into(),
                upstream: "refs/remotes/origin/old".into(),
                gone: true,
            },
        ]
    );
}

#[tokio::test]
async fn counts_only_the_branches_asked_for() {
    let fixture = diverged();
    let names = vec!["main".to_owned(), "old".to_owned(), "solo".to_owned()];
    let counts = ahead_behind(&git(), &fixture.path(), &names, &cancel())
        .await
        .unwrap();
    assert_eq!(
        counts,
        vec![
            (
                "main".to_owned(),
                Tracking::Counts {
                    ahead: 2,
                    behind: 1
                }
            ),
            ("old".to_owned(), Tracking::Gone),
        ]
    );
    assert!(
        ahead_behind(&git(), &fixture.path(), &[], &cancel())
            .await
            .unwrap()
            .is_empty()
    );
}

#[tokio::test]
async fn sets_and_unsets_an_upstream() {
    let fixture = diverged();
    fixture.git(&["branch", "topic"]);
    set_upstream(
        &git(),
        &fixture.path(),
        "topic",
        "refs/remotes/origin/main",
        &cancel(),
    )
    .await
    .unwrap();
    assert_eq!(fixture.git(&["config", "branch.topic.remote"]), "origin");
    assert_eq!(
        fixture.git(&["config", "branch.topic.merge"]),
        "refs/heads/main"
    );
    // A local branch as upstream: remote ".".
    set_upstream(
        &git(),
        &fixture.path(),
        "topic",
        "refs/heads/main",
        &cancel(),
    )
    .await
    .unwrap();
    assert_eq!(fixture.git(&["config", "branch.topic.remote"]), ".");
    unset_upstream(&git(), &fixture.path(), "topic", &cancel())
        .await
        .unwrap();
    let listed = upstreams(&git(), &fixture.path(), &cancel()).await.unwrap();
    assert!(listed.iter().all(|upstream| upstream.branch != "topic"));
}

#[tokio::test]
async fn refuses_an_upstream_that_does_not_exist() {
    let fixture = diverged();
    let error = set_upstream(
        &git(),
        &fixture.path(),
        "main",
        "refs/remotes/origin/nope",
        &cancel(),
    )
    .await
    .unwrap_err();
    assert!(error.to_string().contains("nope"), "{error}");
}
