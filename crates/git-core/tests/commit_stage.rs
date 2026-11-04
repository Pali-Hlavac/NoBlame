//! Staging, unstaging and committing through the real `git`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::commit::{
    CommitError, CommitOptions, commit, head_message, stage_all, stage_paths, unstage_all,
    unstage_paths,
};
use git_core::repo::Repository;
use gix::bstr::{BStr, ByteSlice};
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn git() -> Git {
    Git::locate().expect("tests need git on PATH")
}

fn write(fixture: &Fixture, name: &str, content: &str) {
    fs::write(fixture.path().join(name), content).unwrap();
}

/// The commands under test run with the test process's environment, so the identity and
/// anything from the user's global config that changes committing are set in the repository.
fn local_config(fixture: &Fixture) {
    fixture.git(&["config", "user.name", "Ada Lovelace"]);
    fixture.git(&["config", "user.email", "ada@example.com"]);
    fixture.git(&["config", "commit.gpgSign", "false"]);
    fixture.git(&["config", "core.hooksPath", ".git/hooks"]);
}

/// `a.txt`, `b.txt` and `[ab].txt` committed.
fn committed() -> Fixture {
    let fixture = Fixture::new();
    local_config(&fixture);
    for name in ["a.txt", "b.txt", "[ab].txt"] {
        write(&fixture, name, "base\n");
    }
    fixture.git(&["add", "--all"]);
    fixture.commit("base");
    fixture
}

/// Each file as `XY path` (porcelain v2 states: `.` is unchanged), sorted.
fn porcelain(fixture: &Fixture) -> Vec<String> {
    let mut lines: Vec<String> = fixture
        .git(&["status", "--porcelain=v2", "--untracked-files=all"])
        .lines()
        .map(|line| {
            if let Some(path) = line.strip_prefix("? ") {
                return format!("?? {path}");
            }
            let fields: Vec<&str> = line.split(' ').collect();
            format!("{} {}", fields[1], fields[fields.len() - 1])
        })
        .collect();
    lines.sort();
    lines
}

fn paths<'a>(names: &[&'a str]) -> Vec<&'a BStr> {
    names.iter().map(|name| name.as_bytes().as_bstr()).collect()
}

#[tokio::test]
async fn stages_changes_new_files_and_deletions_by_literal_path() {
    let fixture = committed();
    for name in ["a.txt", "b.txt", "[ab].txt"] {
        write(&fixture, name, "changed\n");
    }
    write(&fixture, "new.txt", "new\n");
    fs::remove_file(fixture.path().join("b.txt")).unwrap();
    let cancel = CancellationToken::new();

    // As a pattern, `[ab].txt` would match a.txt and b.txt, not itself.
    stage_paths(
        &git(),
        &fixture.path(),
        &paths(&["[ab].txt", "new.txt", "b.txt"]),
        &cancel,
    )
    .await
    .unwrap();

    assert_eq!(
        porcelain(&fixture),
        [".M a.txt", "A. new.txt", "D. b.txt", "M. [ab].txt"]
    );
}

#[tokio::test]
async fn unstages_paths_and_everything() {
    let fixture = committed();
    write(&fixture, "a.txt", "changed\n");
    write(&fixture, "b.txt", "changed\n");
    let (git, cancel) = (git(), CancellationToken::new());
    stage_all(&git, &fixture.path(), &cancel).await.unwrap();
    assert_eq!(porcelain(&fixture), ["M. a.txt", "M. b.txt"]);

    unstage_paths(&git, &fixture.path(), &paths(&["a.txt"]), &cancel)
        .await
        .unwrap();
    assert_eq!(porcelain(&fixture), [".M a.txt", "M. b.txt"]);

    unstage_all(&git, &fixture.path(), &cancel).await.unwrap();
    assert_eq!(porcelain(&fixture), [".M a.txt", ".M b.txt"]);
}

#[tokio::test]
async fn unstages_on_a_branch_without_commits() {
    let fixture = Fixture::new();
    write(&fixture, "a.txt", "a\n");
    write(&fixture, "b.txt", "b\n");
    fixture.git(&["add", "--all"]);
    let (git, cancel) = (git(), CancellationToken::new());

    unstage_paths(&git, &fixture.path(), &paths(&["a.txt"]), &cancel)
        .await
        .unwrap();
    assert_eq!(porcelain(&fixture), ["?? a.txt", "A. b.txt"]);

    unstage_all(&git, &fixture.path(), &cancel).await.unwrap();
    assert_eq!(porcelain(&fixture), ["?? a.txt", "?? b.txt"]);
}

#[tokio::test]
async fn unstaging_everything_keeps_a_merge_in_progress() {
    let fixture = committed();
    fixture.git(&["switch", "--quiet", "-c", "side"]);
    write(&fixture, "a.txt", "side\n");
    fixture.git(&["add", "a.txt"]);
    fixture.commit("side");
    fixture.git(&["switch", "--quiet", "main"]);
    fixture.git(&["merge", "--no-ff", "--no-commit", "side"]);

    unstage_all(&git(), &fixture.path(), &CancellationToken::new())
        .await
        .unwrap();

    assert!(fixture.path().join(".git/MERGE_HEAD").exists());
    assert_eq!(porcelain(&fixture), [".M a.txt"]);
}

#[tokio::test]
async fn commits_amends_and_signs_off() {
    let fixture = committed();
    write(&fixture, "a.txt", "changed\n");
    let (git, cancel) = (git(), CancellationToken::new());
    stage_paths(&git, &fixture.path(), &paths(&["a.txt"]), &cancel)
        .await
        .unwrap();

    let options = CommitOptions {
        message: "Change a\n\n#42 stays: comments are not stripped".into(),
        ..CommitOptions::default()
    };
    let output = commit(&git, &fixture.path(), &options, &cancel)
        .await
        .unwrap();
    assert!(output.output.contains("Change a"), "{}", output.output);
    assert_eq!(fixture.git(&["rev-list", "--count", "HEAD"]), "2");
    assert!(porcelain(&fixture).is_empty());

    let amend = CommitOptions {
        message: "Change a, reworded".into(),
        amend: true,
        sign_off: true,
        ..CommitOptions::default()
    };
    commit(&git, &fixture.path(), &amend, &cancel)
        .await
        .unwrap();
    assert_eq!(fixture.git(&["rev-list", "--count", "HEAD"]), "2");
    let repo = Repository::discover(&fixture.path()).unwrap();
    let message = head_message(&repo.local()).unwrap().unwrap();
    assert_eq!(
        message.to_str_lossy().trim_end(),
        "Change a, reworded\n\nSigned-off-by: Ada Lovelace <ada@example.com>"
    );
}

#[tokio::test]
async fn reports_what_git_and_hooks_printed_when_refused() {
    let fixture = committed();
    let (git, cancel) = (git(), CancellationToken::new());
    let options = CommitOptions {
        message: "Nothing".into(),
        ..CommitOptions::default()
    };
    let Err(CommitError::Rejected { output }) =
        commit(&git, &fixture.path(), &options, &cancel).await
    else {
        panic!("committing nothing must fail");
    };
    assert!(output.contains("nothing to commit"), "{output}");

    let hook = fixture.path().join(".git/hooks/pre-commit");
    fs::write(&hook, "#!/bin/sh\necho 'lint: 3 problems' >&2\nexit 1\n").unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&hook, fs::Permissions::from_mode(0o755)).unwrap();
    }
    write(&fixture, "a.txt", "changed\n");
    stage_all(&git, &fixture.path(), &cancel).await.unwrap();
    let Err(CommitError::Rejected { output }) =
        commit(&git, &fixture.path(), &options, &cancel).await
    else {
        panic!("a failing hook must stop the commit");
    };
    assert!(output.contains("lint: 3 problems"), "{output}");
    assert_eq!(fixture.git(&["rev-list", "--count", "HEAD"]), "1");
}

#[tokio::test]
async fn head_message_is_none_without_commits() {
    let fixture = Fixture::new();
    let repo = Repository::discover(&fixture.path()).unwrap();
    assert_eq!(head_message(&repo.local()).unwrap(), None);
}
