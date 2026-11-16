//! Fetching from a real (local) remote as a job would: streamed, then summarized.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::remote::{FetchOptions, FetchSummary, FetchTarget, fetch_command, summarize_fetch};
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn commit_file(fixture: &Fixture, text: &str) {
    fs::write(fixture.path().join("a.txt"), text).unwrap();
    fixture.git(&["add", "a.txt"]);
    fixture.commit(text.trim());
}

#[tokio::test]
async fn fetches_prunes_and_counts_what_changed() {
    let origin = Fixture::new();
    origin.git(&["config", "core.autocrlf", "false"]);
    commit_file(&origin, "one\n");
    origin.git(&["branch", "topic"]);
    let clone = origin.sibling("clone");
    origin.run(
        &origin.sibling(""),
        &["clone", "--quiet", origin.path().to_str().unwrap(), "clone"],
    );
    commit_file(&origin, "two\n");
    origin.git(&["branch", "fresh"]);
    origin.git(&["branch", "--delete", "topic"]);

    let git = Git::locate().unwrap();
    let options = FetchOptions {
        target: FetchTarget::Remote("origin".into()),
        prune: true,
        submodules: false,
    };
    let command = fetch_command(&git, &clone, &options).unwrap();
    assert!(
        command
            .display()
            .contains("fetch --progress --prune origin")
    );
    let mut lines = Vec::new();
    let output = command
        .stream(&CancellationToken::new(), |line| lines.push(line.text))
        .await
        .unwrap();
    assert!(output.success(), "{}", output.stderr_lossy());
    assert!(
        lines.iter().any(|line| line.starts_with("From ")),
        "{lines:?}"
    );
    assert_eq!(
        summarize_fetch(&output.stderr_lossy()),
        FetchSummary {
            new: 1,
            updated: 1,
            pruned: 1,
            rejected: 0,
        }
    );

    // Nothing new the second time.
    let again = fetch_command(&git, &clone, &options)
        .unwrap()
        .stream(&CancellationToken::new(), |_| {})
        .await
        .unwrap();
    assert!(summarize_fetch(&again.stderr_lossy()).is_empty());
}

#[tokio::test]
async fn an_unknown_remote_fails_with_gits_message() {
    let fixture = Fixture::new();
    let options = FetchOptions {
        target: FetchTarget::Remote("nowhere".into()),
        prune: false,
        submodules: false,
    };
    let output = fetch_command(&Git::locate().unwrap(), &fixture.path(), &options)
        .unwrap()
        .stream(&CancellationToken::new(), |_| {})
        .await
        .unwrap();
    assert!(!output.success());
    assert!(output.stderr_lossy().contains("nowhere"));
    // A name that would read as an option is refused before git runs.
    let dashed = FetchOptions {
        target: FetchTarget::Remote("--upload-pack=evil".into()),
        prune: false,
        submodules: false,
    };
    assert!(fetch_command(&Git::locate().unwrap(), &fixture.path(), &dashed).is_err());
}

#[test]
fn submodules_are_fetched_once_and_pulled_on_request() {
    let fixture = Fixture::new();
    let git = Git::locate().unwrap();
    let options = FetchOptions {
        target: FetchTarget::Default,
        prune: true,
        submodules: true,
    };
    let line = fetch_command(&git, &fixture.path(), &options)
        .unwrap()
        .display();
    assert_eq!(line, "git fetch --progress --prune --recurse-submodules");
    let pull = git_core::remote::pull_command(
        &git,
        &fixture.path(),
        git_core::remote::PullMode::Default,
        true,
    );
    assert_eq!(
        pull.display(),
        "git pull --progress --no-edit --recurse-submodules"
    );
}
