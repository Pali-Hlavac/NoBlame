//! What the message box offers (recent messages, the template, the author) and committing with
//! an author override or a template's comments left out, through the real `git`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::commit::{
    CommitOptions, Identity, author_identity, comment_char, commit, commit_template,
    recent_messages, stage_all,
};
use git_core::repo::Repository;
use gix::bstr::{BString, ByteSlice};
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn repo(fixture: &Fixture) -> gix::Repository {
    Repository::discover(&fixture.path()).unwrap().local()
}

fn texts(messages: Vec<BString>) -> Vec<String> {
    messages
        .into_iter()
        .map(|message| message.to_str_lossy().into_owned())
        .collect()
}

/// A commit by Bob instead of the fixture's Ada.
fn commit_by_bob(fixture: &Fixture, message: &str) {
    fixture.commit(message);
    fixture.git(&[
        "commit",
        "--amend",
        "--allow-empty",
        "--quiet",
        "--no-edit",
        "--author=Bob <bob@example.com>",
    ]);
}

#[test]
fn recent_messages_are_the_users_own_newest_first_and_distinct() {
    let fixture = Fixture::new();
    fixture.commit("First\n\nWith a body");
    commit_by_bob(&fixture, "Bob's change");
    fixture.commit("Fix typo");
    fixture.commit("Fix typo");
    fixture.commit("Latest");
    let repo = repo(&fixture);

    let own = recent_messages(&repo, Some(b"ADA@example.com"), 10).unwrap();
    assert_eq!(texts(own), ["Latest", "Fix typo", "First\n\nWith a body"]);

    let two = recent_messages(&repo, Some(b"ada@example.com"), 2).unwrap();
    assert_eq!(texts(two), ["Latest", "Fix typo"]);

    let anyone = recent_messages(&repo, None, 10).unwrap();
    assert_eq!(anyone.len(), 4);
    assert_eq!(anyone[2], "Bob's change");
}

#[test]
fn recent_messages_are_empty_without_commits() {
    let fixture = Fixture::new();
    assert!(
        recent_messages(&repo(&fixture), None, 10)
            .unwrap()
            .is_empty()
    );
}

#[test]
fn reads_the_template_relative_to_the_working_tree() {
    let fixture = Fixture::new();
    let repo_now = repo(&fixture);
    assert_eq!(commit_template(&repo_now, &fixture.path()), None);

    fs::write(fixture.path().join(".gitmessage"), "Summary\n\n# Why?\n").unwrap();
    fixture.git(&["config", "commit.template", ".gitmessage"]);
    let template = commit_template(&repo(&fixture), &fixture.path()).unwrap();
    assert_eq!(template.path, fixture.path().join(".gitmessage"));
    assert_eq!(template.text.unwrap(), "Summary\n\n# Why?\n");

    fixture.git(&["config", "commit.template", "missing.txt"]);
    let template = commit_template(&repo(&fixture), &fixture.path()).unwrap();
    assert!(template.text.is_err());
}

#[test]
fn author_and_comment_character_come_from_the_config() {
    let fixture = Fixture::new();
    fixture.git(&["config", "user.name", "Ada Lovelace"]);
    fixture.git(&["config", "user.email", "ada@example.com"]);
    fixture.git(&["config", "core.commentChar", ";"]);
    let repo = repo(&fixture);
    let author = author_identity(&repo).unwrap();
    assert_eq!(author.to_string(), "Ada Lovelace <ada@example.com>");
    assert_eq!(comment_char(&repo), ';');
}

#[test]
fn parses_an_author_override() {
    let parsed = Identity::parse("  Grace Hopper <grace@example.com> ").unwrap();
    assert_eq!(parsed.name, "Grace Hopper");
    assert_eq!(parsed.email, "grace@example.com");
    for wrong in [
        "Grace",
        "<grace@example.com>",
        "Grace <>",
        "Grace <grace@example.com",
        "Gr<ace <grace@example.com>",
        "Grace\nHopper <grace@example.com>",
    ] {
        assert_eq!(Identity::parse(wrong), None, "{wrong:?}");
    }
}

#[tokio::test]
async fn commits_with_another_author_and_without_the_templates_comments() {
    let fixture = Fixture::new();
    fixture.git(&["config", "user.name", "Ada Lovelace"]);
    fixture.git(&["config", "user.email", "ada@example.com"]);
    fixture.git(&["config", "commit.gpgSign", "false"]);
    fixture.git(&["config", "core.hooksPath", ".git/hooks"]);
    fs::write(fixture.path().join("a.txt"), "a\n").unwrap();
    let (git, cancel) = (Git::locate().unwrap(), CancellationToken::new());
    stage_all(&git, &fixture.path(), &cancel).await.unwrap();

    let options = CommitOptions {
        message: "Add a\n\n# Why? Explain here.\nBecause.\n".into(),
        author: Identity::parse("Grace Hopper <grace@example.com>"),
        strip_comments: true,
        ..CommitOptions::default()
    };
    commit(&git, &fixture.path(), &options, &cancel)
        .await
        .unwrap();

    let format = "--format=%an <%ae>|%cn|%B";
    let shown = fixture.git(&["log", "-1", format]);
    assert_eq!(
        shown,
        "Grace Hopper <grace@example.com>|Ada Lovelace|Add a\n\nBecause."
    );
}
