//! Pushing and pulling between two clones of a bare repository, through the real `git`, as the
//! jobs run them (streamed, then summarized).
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;
use std::path::{Path, PathBuf};

use git_core::cli::{Git, GitOutput};
use git_core::remote::{
    Lease, PullMode, PushOptions, PushWhat, describe_pull, describe_push, pull_command, pull_hint,
    push_command, push_hint, summarize_push,
};
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn git() -> Git {
    Git::locate().unwrap()
}

struct Setup {
    origin: Fixture,
    work: PathBuf,
    other: PathBuf,
}

/// `origin` (bare) with one commit on `main`, cloned as `work` and `other`.
fn setup() -> Setup {
    let origin = Fixture::bare();
    let seed = origin.sibling("seed");
    origin.run(
        &origin.sibling(""),
        &["init", "--quiet", "--initial-branch=main", "seed"],
    );
    commit(&origin, &seed, "a.txt", "one\n");
    origin.run(
        &seed,
        &["push", "--quiet", origin.path().to_str().unwrap(), "main"],
    );
    let clone = |name: &str| {
        origin.run(
            &origin.sibling(""),
            &["clone", "--quiet", origin.path().to_str().unwrap(), name],
        );
        let dir = origin.sibling(name);
        // Library calls run with the test's environment: identity and line endings here.
        origin.run(&dir, &["config", "user.name", "Ada"]);
        origin.run(&dir, &["config", "user.email", "ada@example.com"]);
        origin.run(&dir, &["config", "core.autocrlf", "false"]);
        dir
    };
    let (work, other) = (clone("work"), clone("other"));
    Setup {
        origin,
        work,
        other,
    }
}

fn commit(fixture: &Fixture, dir: &Path, file: &str, text: &str) {
    fs::write(dir.join(file), text).unwrap();
    fixture.run(dir, &["add", file]);
    fixture.run(dir, &["commit", "--quiet", "-m", text.trim()]);
}

async fn run(command: git_core::cli::GitCommand) -> GitOutput {
    command
        .stream(&CancellationToken::new(), |_| {})
        .await
        .unwrap()
}

fn push(dir: &Path, what: PushWhat) -> git_core::cli::GitCommand {
    let options = PushOptions {
        remote: "origin".into(),
        what,
    };
    push_command(&git(), dir, &options).unwrap()
}

fn branch(local: &str, set_upstream: bool, force: Option<Lease>) -> PushWhat {
    PushWhat::Branch {
        local: local.into(),
        remote_branch: local.into(),
        set_upstream,
        follow_tags: false,
        force,
    }
}

#[tokio::test]
async fn pushes_a_new_branch_with_upstream_then_a_tag_then_deletes_it() {
    let s = setup();
    s.origin
        .run(&s.work, &["switch", "--quiet", "--create", "topic"]);
    commit(&s.origin, &s.work, "b.txt", "topic\n");
    let output = run(push(&s.work, branch("topic", true, None))).await;
    assert!(output.success(), "{}", output.stderr_lossy());
    assert_eq!(
        describe_push(summarize_push(&output.stdout_lossy())),
        "1 new"
    );
    assert_eq!(
        s.origin.run(&s.work, &["config", "branch.topic.remote"]),
        "origin"
    );

    s.origin.run(&s.work, &["tag", "v1"]);
    let tagged = run(push(&s.work, PushWhat::Tag("v1".into()))).await;
    assert!(tagged.success());
    assert_eq!(s.origin.git(&["tag", "--list"]), "v1");

    let deleted = run(push(&s.work, PushWhat::Delete("refs/tags/v1".into()))).await;
    assert!(deleted.success(), "{}", deleted.stderr_lossy());
    assert_eq!(
        describe_push(summarize_push(&deleted.stdout_lossy())),
        "1 deleted"
    );
    assert_eq!(s.origin.git(&["tag", "--list"]), "");
}

#[tokio::test]
async fn refuses_behind_pushes_and_ff_only_pulls_then_merges() {
    let s = setup();
    commit(&s.origin, &s.other, "c.txt", "theirs\n");
    s.origin.run(&s.other, &["push", "--quiet"]);
    commit(&s.origin, &s.work, "d.txt", "ours\n");

    let rejected = run(push(&s.work, branch("main", false, None))).await;
    assert!(!rejected.success());
    assert_eq!(summarize_push(&rejected.stdout_lossy()).rejected, 1);
    assert!(push_hint(&rejected.stdout_lossy()).is_some_and(|hint| hint.contains("Pull")));

    let ff_only = run(pull_command(&git(), &s.work, PullMode::FastForwardOnly)).await;
    assert!(!ff_only.success());
    assert!(
        pull_hint(&ff_only.stderr_lossy()).is_some(),
        "{}",
        ff_only.stderr_lossy()
    );

    let merged = run(pull_command(&git(), &s.work, PullMode::Merge)).await;
    assert!(merged.success(), "{}", merged.stderr_lossy());
    assert!(
        describe_pull(&merged.stdout_lossy(), &merged.stderr_lossy()).starts_with("Merged"),
        "{}",
        merged.stdout_lossy()
    );
    assert!(
        run(push(&s.work, branch("main", false, None)))
            .await
            .success()
    );
}

/// Force with lease replaces only what the user was shown: someone else's newer commit stays.
#[tokio::test]
async fn force_with_lease_keeps_commits_it_has_not_seen() {
    let s = setup();
    let seen = s.origin.run(&s.work, &["rev-parse", "origin/main"]);
    commit(&s.origin, &s.other, "e.txt", "theirs\n");
    s.origin.run(&s.other, &["push", "--quiet"]);
    s.origin.run(
        &s.work,
        &["commit", "--quiet", "--amend", "-m", "rewritten"],
    );
    let lease = |hex: &str| Some(Lease::At(gix::ObjectId::from_hex(hex.as_bytes()).unwrap()));

    let stale = run(push(&s.work, branch("main", false, lease(&seen)))).await;
    assert!(!stale.success());
    let text = format!("{}\n{}", stale.stdout_lossy(), stale.stderr_lossy());
    assert!(
        push_hint(&text).is_some_and(|hint| hint.contains("Fetch")),
        "{text}"
    );

    // After a fetch the dialog shows the new commit; forcing over exactly it works.
    s.origin.run(&s.work, &["fetch", "--quiet"]);
    let shown = s.origin.run(&s.work, &["rev-parse", "origin/main"]);
    let forced = run(push(&s.work, branch("main", false, lease(&shown)))).await;
    assert!(forced.success(), "{}", forced.stderr_lossy());
    assert_eq!(
        describe_push(summarize_push(&forced.stdout_lossy())),
        "1 replaced"
    );

    // A branch that must not exist there yet is not replaced when it does.
    s.origin
        .run(&s.work, &["commit", "--quiet", "--amend", "-m", "again"]);
    let absent = run(push(&s.work, branch("main", false, Some(Lease::Absent)))).await;
    assert!(!absent.success());
}
