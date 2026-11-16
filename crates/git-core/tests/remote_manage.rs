//! Managing remotes and fetching every remote one by one, through the real `git`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;
use std::path::Path;

use git_core::branch::BranchError;
use git_core::cli::{Git, GitCommand};
use git_core::remote::{
    FetchOptions, FetchTarget, UrlKind, add_remote, fetch_commands, remote_details, remove_remote,
    rename_remote, set_remote_url, unset_push_url,
};
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn git() -> Git {
    Git::locate().unwrap()
}

fn cancel() -> CancellationToken {
    CancellationToken::new()
}

/// A repository with two commits on `main` and a `topic` branch.
fn origin() -> Fixture {
    let origin = Fixture::new();
    origin.git(&["config", "core.autocrlf", "false"]);
    for text in ["one\n", "two\n"] {
        fs::write(origin.path().join("a.txt"), text).unwrap();
        origin.git(&["add", "a.txt"]);
        origin.commit(text.trim());
    }
    origin.git(&["branch", "topic"]);
    origin
}

fn open(path: &Path) -> gix::Repository {
    gix::open(path).unwrap()
}

#[tokio::test]
async fn adds_edits_renames_and_removes_remotes() {
    let origin = origin();
    let url = origin.path().to_str().unwrap().to_owned();
    let work = origin.sibling("work");
    origin.run(&origin.sibling(""), &["clone", "--quiet", &url, "work"]);
    let git = git();

    add_remote(&git, &work, "mirror", &url, &cancel())
        .await
        .unwrap();
    origin.run(&work, &["fetch", "--quiet", "mirror"]);
    origin.run(&work, &["branch", "--set-upstream-to=mirror/topic", "main"]);
    set_remote_url(
        &git,
        &work,
        "mirror",
        UrlKind::Push,
        "https://example.com/m.git",
        &cancel(),
    )
    .await
    .unwrap();

    let details = remote_details(&open(&work)).unwrap();
    let names: Vec<_> = details.iter().map(|remote| remote.name.as_str()).collect();
    assert_eq!(names, ["mirror", "origin"]);
    let mirror = &details[0];
    assert_eq!(mirror.url.as_deref(), Some(url.as_str()));
    assert_eq!(
        mirror.push_url.as_deref(),
        Some("https://example.com/m.git")
    );
    assert_eq!((mirror.branches, mirror.extra_urls), (2, 0));
    assert_eq!(mirror.tracked_by, ["main"]);
    // origin/HEAD is not a branch.
    assert_eq!(details[1].branches, 2);
    assert!(details[1].tracked_by.is_empty());

    unset_push_url(&git, &work, "mirror", &cancel())
        .await
        .unwrap();
    // Unsetting again is fine.
    unset_push_url(&git, &work, "mirror", &cancel())
        .await
        .unwrap();
    rename_remote(&git, &work, "mirror", "backup", &cancel())
        .await
        .unwrap();
    let details = remote_details(&open(&work)).unwrap();
    let backup = &details[0];
    assert_eq!(
        (backup.name.as_str(), backup.push_url.as_deref()),
        ("backup", None)
    );
    assert_eq!(
        (backup.branches, backup.tracked_by.clone()),
        (2, vec!["main".to_owned()])
    );

    remove_remote(&git, &work, "backup", &cancel())
        .await
        .unwrap();
    let details = remote_details(&open(&work)).unwrap();
    assert_eq!(details.len(), 1);
    assert!(
        origin
            .run(&work, &["branch", "--remotes"])
            .lines()
            .all(|line| !line.contains("backup"))
    );
    let config = origin.run(&work, &["config", "--list", "--local"]);
    assert!(!config.contains("branch.main.remote"), "{config}");
}

#[tokio::test]
async fn refuses_names_and_urls_git_would_misread() {
    let origin = origin();
    let git = git();
    let dir = origin.path();
    for name in ["-x", "a b", "a..b", "", "a:b"] {
        let error = add_remote(&git, &dir, name, "https://example.com/r.git", &cancel()).await;
        assert!(
            matches!(error, Err(BranchError::InvalidName { .. })),
            "{name}: {error:?}"
        );
    }
    for url in ["--upload-pack=evil", "", "a\nb", " https://x"] {
        let error = add_remote(&git, &dir, "x", url, &cancel()).await;
        assert!(
            matches!(error, Err(BranchError::InvalidUrl { .. })),
            "{url:?}: {error:?}"
        );
    }
    // git's own refusal comes back as its words.
    let missing = remove_remote(&git, &dir, "nowhere", &cancel()).await;
    assert!(matches!(missing, Err(BranchError::Rejected { output }) if output.contains("nowhere")));
}

#[tokio::test]
async fn fetches_every_remote_one_by_one_with_progress() {
    let origin = origin();
    let url = origin.path().to_str().unwrap().to_owned();
    let work = origin.sibling("work");
    origin.run(&origin.sibling(""), &["init", "--quiet", "work"]);
    for remote in ["a", "b", "skipped"] {
        origin.run(&work, &["remote", "add", remote, &url]);
    }
    origin.run(&work, &["config", "remote.skipped.skipFetchAll", "true"]);
    let options = FetchOptions {
        target: FetchTarget::All,
        prune: true,
        submodules: false,
    };
    let commands = fetch_commands(&git(), &work, &open(&work), &options).unwrap();
    let lines: Vec<_> = commands.iter().map(GitCommand::display).collect();
    assert_eq!(
        lines,
        [
            "git fetch --progress --prune a",
            "git fetch --progress --append --prune b"
        ]
    );
    let mut progress = 0;
    for command in commands {
        let output = command
            .stream(&cancel(), |line| progress += usize::from(line.progress))
            .await
            .unwrap();
        assert!(output.success(), "{}", output.stderr_lossy());
    }
    assert!(progress > 0, "each fetch shows its progress");
    let branches = origin.run(&work, &["branch", "--remotes"]);
    assert!(
        branches.contains("a/topic") && branches.contains("b/topic"),
        "{branches}"
    );
    assert!(!branches.contains("skipped/"), "{branches}");
    let fetch_head = fs::read_to_string(work.join(".git/FETCH_HEAD")).unwrap();
    assert!(fetch_head.lines().count() >= 4, "{fetch_head}");
}
