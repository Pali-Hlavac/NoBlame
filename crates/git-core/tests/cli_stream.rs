//! Streaming git's output line by line, and killing git with everything it started.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::time::Duration;

use git_core::cli::{Git, GitError, OutputLine, OutputStream};
use tokio_util::sync::CancellationToken;

fn git() -> Git {
    Git::locate().expect("tests need git on PATH")
}

fn line(text: &str, stream: OutputStream, progress: bool) -> OutputLine {
    OutputLine {
        text: text.into(),
        stream,
        progress,
    }
}

#[tokio::test]
async fn hands_over_lines_and_marks_progress() {
    let mut lines = Vec::new();
    let output = git()
        .command()
        .args([
            "-c",
            r"alias.talk=!printf '10%%\r100%%, done.\nFrom here\n' >&2; echo out",
            "talk",
        ])
        .stream(&CancellationToken::new(), |line| lines.push(line))
        .await
        .unwrap();
    assert!(output.success());
    assert_eq!(output.stdout_lossy().trim(), "out");
    // The progress update is not kept in standard error.
    assert_eq!(output.stderr_lossy(), "100%, done.\nFrom here");
    let stderr: Vec<_> = lines
        .iter()
        .filter(|line| line.stream == OutputStream::Stderr)
        .cloned()
        .collect();
    assert_eq!(
        stderr,
        vec![
            line("10%", OutputStream::Stderr, true),
            line("100%, done.", OutputStream::Stderr, false),
            line("From here", OutputStream::Stderr, false),
        ]
    );
    assert!(lines.contains(&line("out", OutputStream::Stdout, false)));
}

/// Cancelling kills the programs git started, not only git: the `sh` running the alias would
/// otherwise go on and write the marker file.
#[tokio::test]
async fn cancelling_kills_the_whole_process_tree() {
    let dir = tempfile::tempdir().unwrap();
    let cancel = CancellationToken::new();
    let trigger = cancel.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(500)).await;
        trigger.cancel();
    });
    let result = git()
        .command()
        .current_dir(dir.path())
        .args(["-c", "alias.slow=!sleep 2 && echo late > marker", "slow"])
        .stream(&cancel, |_| {})
        .await;
    assert!(
        matches!(result, Err(GitError::Cancelled { .. })),
        "{result:?}"
    );
    tokio::time::sleep(Duration::from_secs(3)).await;
    assert!(
        !dir.path().join("marker").exists(),
        "the alias's shell outlived the cancel"
    );
}

/// The same for the ordinary runner.
#[tokio::test]
async fn cancelling_output_kills_the_whole_process_tree() {
    let dir = tempfile::tempdir().unwrap();
    let cancel = CancellationToken::new();
    let trigger = cancel.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(500)).await;
        trigger.cancel();
    });
    let result = git()
        .command()
        .current_dir(dir.path())
        .args(["-c", "alias.slow=!sleep 2 && echo late > marker", "slow"])
        .output(&cancel)
        .await;
    assert!(matches!(result, Err(GitError::Cancelled { .. })));
    tokio::time::sleep(Duration::from_secs(3)).await;
    assert!(!dir.path().join("marker").exists());
}
