//! Runs the user's real `git` through `GitCommand`.
// Test helpers may panic: a failed setup step is a failed test.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::time::{Duration, Instant};

use git_core::cli::{Git, GitError, MIN_GIT_VERSION};
use noblame_repo_gen::{Preset, generate};
use tokio_util::sync::CancellationToken;

/// Upper bound for a cancelled command to return; the child sleeps longer. The sleep is kept
/// short because the orphaned `sleep` grandchild holds the output pipe until it exits, and
/// on Windows the runtime waits for that pipe reader on shutdown (see background-jobs.md).
const CANCEL_DEADLINE: Duration = Duration::from_secs(3);
const CANCEL_AFTER: Duration = Duration::from_millis(300);

fn git() -> Git {
    Git::locate().expect("tests need git on PATH")
}

#[tokio::test]
async fn reports_a_supported_version() {
    let version = git().version(&CancellationToken::new()).await.unwrap();
    assert!(
        version >= MIN_GIT_VERSION,
        "{version} is older than {MIN_GIT_VERSION}"
    );
}

#[tokio::test]
async fn reads_a_generated_repository_without_locks() {
    let dir = tempfile::tempdir().unwrap();
    let summary = generate(&Preset::Tiny.spec(), dir.path()).unwrap();
    let output = git()
        .command()
        .current_dir(dir.path())
        .read_only()
        .args(["rev-list", "--count"])
        .revision("main")
        .unwrap()
        .run(&CancellationToken::new())
        .await
        .unwrap();
    let count: u32 = output.stdout_lossy().trim().parse().unwrap();
    assert!(count > 0 && count <= summary.commits);
    assert!(!dir.path().join(".git/index.lock").exists());
}

#[tokio::test]
async fn non_zero_exit_becomes_failed_with_stderr() {
    let dir = tempfile::tempdir().unwrap();
    generate(&Preset::Tiny.spec(), dir.path()).unwrap();
    let result = git()
        .command()
        .current_dir(dir.path())
        .arg("rev-parse")
        .revision("no-such-branch")
        .unwrap()
        .run(&CancellationToken::new())
        .await;
    let Err(GitError::Failed {
        code,
        stderr,
        command,
    }) = result
    else {
        panic!("expected Failed, got {result:?}");
    };
    assert_eq!(code, Some(128));
    assert!(stderr.contains("no-such-branch"), "{stderr}");
    assert_eq!(command, "git rev-parse no-such-branch");
}

#[tokio::test]
async fn feeds_stdin_and_returns_raw_stdout() {
    let output = git()
        .command()
        .args(["hash-object", "--stdin"])
        .stdin(b"hello\n".to_vec())
        .run(&CancellationToken::new())
        .await
        .unwrap();
    // `printf 'hello\n' | git hash-object --stdin`
    assert_eq!(
        output.stdout_lossy().trim(),
        "ce013625030ba8dba906f756967f9e9ca394464a"
    );
}

#[tokio::test]
async fn cancellation_kills_the_process() {
    let cancel = CancellationToken::new();
    let trigger = cancel.clone();
    tokio::spawn(async move {
        tokio::time::sleep(CANCEL_AFTER).await;
        trigger.cancel();
    });
    let started = Instant::now();
    let result = git()
        .command()
        .args(["-c", "alias.wait=!sleep 6", "wait"])
        .output(&cancel)
        .await;
    assert!(
        matches!(result, Err(GitError::Cancelled { .. })),
        "{result:?}"
    );
    assert!(
        started.elapsed() < CANCEL_DEADLINE,
        "took {:?}",
        started.elapsed()
    );
}

#[tokio::test]
async fn an_already_cancelled_token_never_starts_git() {
    let cancel = CancellationToken::new();
    cancel.cancel();
    let result = Git::at("does-not-exist")
        .command()
        .arg("status")
        .output(&cancel)
        .await;
    assert!(matches!(result, Err(GitError::Cancelled { .. })));
}

#[tokio::test]
async fn missing_executable_is_a_spawn_error() {
    let result = Git::at("does-not-exist/git")
        .command()
        .arg("status")
        .output(&CancellationToken::new())
        .await;
    assert!(matches!(result, Err(GitError::Spawn { .. })), "{result:?}");
}
