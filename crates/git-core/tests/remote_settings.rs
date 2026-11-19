//! The remote editor's saving, through the real `git`: several keys and values, the default
//! branch and a rename all at once, hidden passwords kept, and every change undone when a
//! later step fails.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;
use std::path::Path;

use git_core::cli::Git;
use git_core::config::{
    KeyChange, PlanError, PlannedKey, Scope, ScopedEntry, apply_plan, read_all_scopes,
};
use git_core::remote::{
    HeadChange, RemoteEdit, apply_remote_edit, describe_remote_edit, plan_remote_edit, remote_head,
};
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn git() -> Git {
    Git::locate().unwrap()
}

fn cancel() -> CancellationToken {
    CancellationToken::new()
}

/// A clone of a repository with `main` and `topic`, `main` tracking `origin/main`.
fn clone() -> (Fixture, std::path::PathBuf) {
    let origin = Fixture::new();
    origin.git(&["config", "core.autocrlf", "false"]);
    fs::write(origin.path().join("a.txt"), "one\n").unwrap();
    origin.git(&["add", "a.txt"]);
    origin.commit("one");
    origin.git(&["branch", "topic"]);
    let url = origin.path().to_str().unwrap().to_owned();
    let work = origin.sibling("work");
    origin.run(&origin.sibling(""), &["clone", "--quiet", &url, "work"]);
    (origin, work)
}

async fn local(work: &Path, key: &str) -> Vec<String> {
    read_all_scopes(&git(), work, &cancel())
        .await
        .unwrap()
        .into_iter()
        .filter(|entry| entry.scope == Scope::Local && entry.key == key)
        .map(|entry| entry.value)
        .collect()
}

fn change(key: &str, before: &[&str], after: &[&str]) -> KeyChange {
    KeyChange {
        key: key.into(),
        before: before.iter().map(|v| (*v).to_owned()).collect(),
        after: after.iter().map(|v| (*v).to_owned()).collect(),
    }
}

async fn current(work: &Path) -> Vec<ScopedEntry> {
    read_all_scopes(&git(), work, &cancel()).await.unwrap()
}

#[tokio::test]
async fn saves_keys_push_urls_default_branch_and_name_together() {
    let (_origin, work) = clone();
    let repo = gix::open(&work).unwrap();
    let head = remote_head(&repo, "origin");
    assert!(head.is_some(), "a clone sets origin/HEAD");
    let edit = RemoteEdit {
        name: "origin".into(),
        new_name: Some("upstream".into()),
        head: Some(HeadChange {
            before: head,
            after: Some("topic".into()),
        }),
        keys: vec![
            change(
                "remote.origin.pushurl",
                &[],
                &["https://a.example/r.git", "https://b.example/r.git"],
            ),
            change("remote.origin.tagOpt", &[], &["--no-tags"]),
        ],
    };
    let plan = plan_remote_edit(
        &current(&work).await,
        remote_head(&repo, "origin").as_deref(),
        &edit,
    )
    .unwrap();
    assert_eq!(
        describe_remote_edit(&plan),
        [
            "git config --local --add remote.origin.pushurl https://a.example/r.git",
            "git config --local --add remote.origin.pushurl https://b.example/r.git",
            "git config --local --replace-all remote.origin.tagOpt --no-tags",
            "git remote set-head origin topic",
            "git remote rename origin upstream",
        ]
    );
    apply_remote_edit(&git(), &work, &plan, &cancel())
        .await
        .unwrap();

    assert_eq!(
        local(&work, "remote.upstream.pushurl").await,
        ["https://a.example/r.git", "https://b.example/r.git"]
    );
    assert_eq!(local(&work, "remote.upstream.tagopt").await, ["--no-tags"]);
    // The branch tracking it follows the rename, and so does the default branch.
    assert_eq!(local(&work, "branch.main.remote").await, ["upstream"]);
    let repo = gix::open(&work).unwrap();
    assert_eq!(remote_head(&repo, "upstream").as_deref(), Some("topic"));
    assert!(local(&work, "remote.origin.url").await.is_empty());
}

#[tokio::test]
async fn keeps_a_hidden_password_and_refuses_stale_values() {
    let (origin, work) = clone();
    origin.run(
        &work,
        &[
            "config",
            "remote.origin.pushurl",
            "https://ada:t0k@h.example/r",
        ],
    );
    let shown = ["https://ada:***@h.example/r"];
    let keep_and_add = change(
        "remote.origin.pushurl",
        &shown,
        &["https://ada:***@h.example/r", "https://h.example/s"],
    );
    let edit = |keys| RemoteEdit {
        name: "origin".into(),
        new_name: None,
        head: None,
        keys,
    };
    let plan = plan_remote_edit(&current(&work).await, None, &edit(vec![keep_and_add])).unwrap();
    apply_remote_edit(&git(), &work, &plan, &cancel())
        .await
        .unwrap();
    assert_eq!(
        local(&work, "remote.origin.pushurl").await,
        ["https://ada:t0k@h.example/r", "https://h.example/s"]
    );

    // The editor still shows the single URL it read before: saving again is refused.
    let stale = change("remote.origin.pushurl", &shown, &[]);
    let error = plan_remote_edit(&current(&work).await, None, &edit(vec![stale])).unwrap_err();
    assert!(matches!(error, PlanError::Changed { .. }), "{error}");
}

#[tokio::test]
async fn puts_everything_back_when_a_write_fails() {
    let (_origin, work) = clone();
    let url = local(&work, "remote.origin.url").await;
    let plan = [
        PlannedKey {
            key: "remote.origin.url".into(),
            before: url.clone(),
            after: vec!["https://changed.example/r".into()],
        },
        PlannedKey {
            key: "remote.origin.prune".into(),
            before: vec![],
            after: vec!["true".into()],
        },
        // git refuses a key without a name.
        PlannedKey {
            key: "remote.origin.".into(),
            before: vec![],
            after: vec!["x".into()],
        },
    ];
    let error = apply_plan(&git(), &work, &plan, &cancel())
        .await
        .unwrap_err();
    assert!(
        matches!(error, PlanError::Failed { restored: true, .. }),
        "{error}"
    );
    assert_eq!(local(&work, "remote.origin.url").await, url);
    assert!(local(&work, "remote.origin.prune").await.is_empty());
}

#[tokio::test]
async fn undoes_the_keys_when_the_rename_fails() {
    let (origin, work) = clone();
    origin.run(&work, &["remote", "add", "taken", "https://h.example/t"]);
    let edit = RemoteEdit {
        name: "origin".into(),
        new_name: Some("taken".into()),
        head: None,
        keys: vec![change("remote.origin.prune", &[], &["true"])],
    };
    let plan = plan_remote_edit(&current(&work).await, None, &edit).unwrap();
    let error = apply_remote_edit(&git(), &work, &plan, &cancel())
        .await
        .unwrap_err();
    assert!(
        matches!(error, PlanError::Failed { restored: true, .. }),
        "{error}"
    );
    assert!(local(&work, "remote.origin.prune").await.is_empty());
    assert_eq!(
        local(&work, "remote.taken.url").await,
        ["https://h.example/t"]
    );
}
