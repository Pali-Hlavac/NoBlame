//! Talking to a remote without fetching, and moving a password to the credential helper,
//! through the real `git`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::config::read_all_scopes;
use git_core::remote::{
    connection_hint, describe_connection, has_credential_helper, ls_remote_command,
    set_head_auto_command, split_password, store_password,
};
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn git() -> Git {
    Git::locate().unwrap()
}

#[tokio::test]
async fn tests_the_connection_and_asks_for_the_default_branch() {
    let origin = Fixture::new();
    fs::write(origin.path().join("a.txt"), "one\n").unwrap();
    origin.git(&["add", "a.txt"]);
    origin.commit("one");
    origin.git(&["branch", "topic"]);
    let url = origin.path().to_str().unwrap().to_owned();
    let work = origin.sibling("work");
    origin.run(&origin.sibling(""), &["clone", "--quiet", &url, "work"]);
    let cancel = CancellationToken::new();

    let listed = ls_remote_command(&git(), &work, "origin")
        .output(&cancel)
        .await
        .unwrap();
    assert!(listed.success());
    assert_eq!(
        describe_connection(&listed.stdout_lossy()),
        "Connected: 2 branches on the server"
    );

    origin.run(&work, &["remote", "set-head", "origin", "topic"]);
    let set = set_head_auto_command(&git(), &work, "origin")
        .output(&cancel)
        .await
        .unwrap();
    assert!(set.success(), "{}", set.combined());
    let head = origin.run(&work, &["symbolic-ref", "refs/remotes/origin/HEAD"]);
    assert!(!head.trim().ends_with("/topic"), "{head}");

    let missing = ls_remote_command(&git(), &work, "nosuch")
        .output(&cancel)
        .await
        .unwrap();
    assert!(!missing.success());
    assert!(connection_hint(&missing.combined()).is_some());
}

#[tokio::test]
async fn gives_a_password_to_the_credential_helper() {
    let repo = Fixture::new();
    let dir = repo.path().clone();
    let store = repo.sibling("credentials");
    let cancel = CancellationToken::new();
    let helper = format!(
        "store --file \"{}\"",
        store.display().to_string().replace('\\', "/")
    );
    // An empty value first resets the list: only this helper answers, never the user's own
    // (Git Credential Manager would keep this made-up password).
    repo.git(&["config", "--add", "credential.helper", ""]);
    repo.git(&["config", "--add", "credential.helper", &helper]);
    let entries = read_all_scopes(&git(), &dir, &cancel).await.unwrap();
    assert!(has_credential_helper(&entries));

    let split = split_password("https://ada:s3cret@example.com/team/app.git").unwrap();
    store_password(&git(), &dir, &split, &cancel).await.unwrap();
    let stored = fs::read_to_string(&store).unwrap();
    assert!(stored.contains("ada:s3cret@example.com"), "{stored}");
}
