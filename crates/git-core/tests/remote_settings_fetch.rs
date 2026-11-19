//! The remote editor's saves as git then uses them, through the real `git`: fetching only the
//! chosen branches without tags, pruning, and a URL moved to another server taking its
//! `http.<url>.*` and `credential.<url>.*` settings along.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;
use std::path::{Path, PathBuf};

use git_core::cli::Git;
use git_core::config::{KeyChange, Scope, read_all_scopes};
use git_core::remote::{RemoteEdit, apply_remote_edit, plan_remote_edit};
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn git() -> Git {
    Git::locate().unwrap()
}

/// A clone of a repository with `main` and `topic`.
fn clone() -> (Fixture, PathBuf) {
    let origin = Fixture::new();
    fs::write(origin.path().join("a.txt"), "one\n").unwrap();
    origin.git(&["add", "a.txt"]);
    origin.commit("one");
    origin.git(&["branch", "topic"]);
    let url = origin.path().to_str().unwrap().to_owned();
    let work = origin.sibling("work");
    origin.run(&origin.sibling(""), &["clone", "--quiet", &url, "work"]);
    (origin, work)
}

fn change(key: &str, before: &[String], after: &[&str]) -> KeyChange {
    KeyChange {
        key: key.into(),
        before: before.to_vec(),
        after: after.iter().map(|v| (*v).to_owned()).collect(),
    }
}

async fn local(work: &Path, key: &str) -> Vec<String> {
    read_all_scopes(&git(), work, &CancellationToken::new())
        .await
        .unwrap()
        .into_iter()
        .filter(|entry| entry.scope == Scope::Local && entry.key == key)
        .map(|entry| entry.value)
        .collect()
}

/// Plans and saves `keys` for `origin`.
async fn save(work: &Path, keys: Vec<KeyChange>) {
    let cancel = CancellationToken::new();
    let current = read_all_scopes(&git(), work, &cancel).await.unwrap();
    let edit = RemoteEdit {
        name: "origin".into(),
        new_name: None,
        head: None,
        keys,
    };
    let plan = plan_remote_edit(&current, None, &edit).unwrap();
    apply_remote_edit(&git(), work, &plan, &cancel)
        .await
        .unwrap();
}

fn refs(fixture: &Fixture, work: &Path) -> String {
    fixture.run(work, &["show-ref"])
}

#[tokio::test]
async fn fetches_only_the_chosen_branches_and_no_tags() {
    let (origin, work) = clone();
    let fetch = local(&work, "remote.origin.fetch").await;
    save(
        &work,
        vec![
            change(
                "remote.origin.fetch",
                &fetch,
                &["+refs/heads/main:refs/remotes/origin/main"],
            ),
            change("remote.origin.tagOpt", &[], &["--no-tags"]),
        ],
    )
    .await;
    origin.git(&["branch", "extra"]);
    origin.git(&["tag", "v1"]);
    origin.run(&work, &["fetch", "origin"]);

    let listed = refs(&origin, &work);
    assert!(listed.contains("refs/remotes/origin/main"), "{listed}");
    assert!(!listed.contains("refs/remotes/origin/extra"), "{listed}");
    assert!(!listed.contains("refs/tags/v1"), "{listed}");
}

#[tokio::test]
async fn prunes_branches_deleted_on_the_server() {
    let (origin, work) = clone();
    save(&work, vec![change("remote.origin.prune", &[], &["true"])]).await;
    origin.git(&["branch", "-D", "topic"]);
    origin.run(&work, &["fetch", "origin"]);

    let listed = refs(&origin, &work);
    assert!(!listed.contains("refs/remotes/origin/topic"), "{listed}");
    assert!(listed.contains("refs/remotes/origin/main"), "{listed}");
}

#[tokio::test]
async fn moves_url_keyed_settings_with_the_url() {
    let (origin, work) = clone();
    origin.run(
        &work,
        &[
            "config",
            "remote.origin.url",
            "https://old.example/team/app.git",
        ],
    );
    origin.run(
        &work,
        &["config", "http.https://old.example/.sslVerify", "false"],
    );
    origin.run(
        &work,
        &["config", "credential.https://old.example.username", "ada"],
    );
    let url = local(&work, "remote.origin.url").await;
    // What the editor sends when the URL moves and "Move them" is chosen: the old keys removed,
    // the same values under the new server.
    save(
        &work,
        vec![
            change(
                "http.https://old.example/.sslVerify",
                &["false".into()],
                &[],
            ),
            change("http.https://new.example/.sslVerify", &[], &["false"]),
            change(
                "credential.https://old.example.username",
                &["ada".into()],
                &[],
            ),
            change("credential.https://new.example.username", &[], &["ada"]),
            change(
                "remote.origin.url",
                &url,
                &["https://new.example/team/app.git"],
            ),
        ],
    )
    .await;

    assert!(
        local(&work, "http.https://old.example/.sslverify")
            .await
            .is_empty()
    );
    assert!(
        local(&work, "credential.https://old.example.username")
            .await
            .is_empty()
    );
    assert_eq!(
        local(&work, "http.https://new.example/.sslverify").await,
        ["false"]
    );
    assert_eq!(
        local(&work, "credential.https://new.example.username").await,
        ["ada"]
    );
    // git reads them for the new URL.
    let applied = origin.run(
        &work,
        &[
            "config",
            "--get-urlmatch",
            "http.sslVerify",
            "https://new.example/team/app.git",
        ],
    );
    assert_eq!(applied.trim(), "false");
}
