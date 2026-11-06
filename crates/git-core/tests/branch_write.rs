//! Checking out, creating, renaming and deleting branches and tags, and the commits only one
//! of them holds, through the real `git`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::branch::{
    BranchError, CreateBranch, RefNamespace, check_ref, create_branch, create_tag, delete_branch,
    delete_tag, rename_branch, switch_branch, switch_detached, unique_commits,
};
use git_core::cli::Git;
use git_core::repo::Repository;
use gix::ObjectId;
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn git() -> Git {
    Git::locate().expect("tests need git on PATH")
}

fn cancel() -> CancellationToken {
    CancellationToken::new()
}

fn id(hex: &str) -> ObjectId {
    ObjectId::from_hex(hex.as_bytes()).unwrap()
}

fn repo(fixture: &Fixture) -> gix::Repository {
    Repository::discover(&fixture.path()).unwrap().local()
}

/// `main` with two commits; the library calls run with the test's environment, so the
/// identity is set in the repository.
fn two_commits() -> Fixture {
    let fixture = Fixture::new();
    fixture.git(&["config", "user.name", "Ada Lovelace"]);
    fixture.git(&["config", "user.email", "ada@example.com"]);
    fixture.git(&["config", "core.autocrlf", "false"]);
    fs::write(fixture.path().join("a.txt"), "1\n").unwrap();
    fixture.git(&["add", "a.txt"]);
    fixture.commit("first");
    fs::write(fixture.path().join("a.txt"), "2\n").unwrap();
    fixture.git(&["add", "a.txt"]);
    fixture.commit("second");
    fixture
}

fn current_branch(fixture: &Fixture) -> String {
    fixture.git(&["branch", "--show-current"])
}

#[tokio::test]
async fn creates_branches_with_and_without_checking_them_out() {
    let fixture = two_commits();
    let first = fixture.git(&["rev-parse", "HEAD~1"]);
    let branch = CreateBranch {
        name: "topic/a".into(),
        start: first.clone(),
        checkout: false,
        track: false,
    };
    create_branch(&git(), &fixture.path(), &branch, &cancel())
        .await
        .unwrap();
    assert_eq!(fixture.git(&["rev-parse", "topic/a"]), first);
    assert_eq!(current_branch(&fixture), "main");

    let branch = CreateBranch {
        name: "topic/b".into(),
        start: "main".into(),
        checkout: true,
        track: false,
    };
    create_branch(&git(), &fixture.path(), &branch, &cancel())
        .await
        .unwrap();
    assert_eq!(current_branch(&fixture), "topic/b");

    // The name exists: git refuses and says so.
    let error = create_branch(&git(), &fixture.path(), &branch, &cancel())
        .await
        .unwrap_err();
    assert!(
        matches!(&error, BranchError::Rejected { output } if output.contains("already exists")),
        "{error:?}"
    );
}

#[tokio::test]
async fn rejects_names_before_running_git() {
    let fixture = two_commits();
    for name in ["-f", "a b", "x..y", "HEAD"] {
        let branch = CreateBranch {
            name: name.into(),
            start: "main".into(),
            checkout: false,
            track: false,
        };
        let error = create_branch(&git(), &fixture.path(), &branch, &cancel())
            .await
            .unwrap_err();
        assert!(matches!(error, BranchError::InvalidName { .. }), "{name}");
    }
    assert_eq!(fixture.git(&["branch", "--list"]), "* main");
}

#[tokio::test]
async fn checks_out_a_remote_branch_as_a_tracking_branch() {
    let fixture = two_commits();
    let path = fixture.path().display().to_string();
    fixture.git(&["remote", "add", "origin", &path]);
    fixture.git(&["update-ref", "refs/remotes/origin/feature", "HEAD~1"]);
    // Without a local branch of that name, switching never guesses one from the remote.
    let error = switch_branch(&git(), &fixture.path(), "feature", &cancel())
        .await
        .unwrap_err();
    assert!(matches!(error, BranchError::Rejected { .. }));

    let branch = CreateBranch {
        name: "feature".into(),
        start: "origin/feature".into(),
        checkout: true,
        track: true,
    };
    create_branch(&git(), &fixture.path(), &branch, &cancel())
        .await
        .unwrap();
    assert_eq!(current_branch(&fixture), "feature");
    assert_eq!(fixture.git(&["config", "branch.feature.remote"]), "origin");
    assert_eq!(
        fixture.git(&["config", "branch.feature.merge"]),
        "refs/heads/feature"
    );
}

#[tokio::test]
async fn switches_branches_detaches_and_refuses_to_overwrite_changes() {
    let fixture = two_commits();
    fixture.git(&["branch", "old", "HEAD~1"]);
    switch_branch(&git(), &fixture.path(), "old", &cancel())
        .await
        .unwrap();
    assert_eq!(current_branch(&fixture), "old");
    assert_eq!(
        fs::read_to_string(fixture.path().join("a.txt")).unwrap(),
        "1\n"
    );

    // A change to a file that differs between the branches is in the way.
    fs::write(fixture.path().join("a.txt"), "mine\n").unwrap();
    let error = switch_branch(&git(), &fixture.path(), "main", &cancel())
        .await
        .unwrap_err();
    assert!(
        matches!(&error, BranchError::Rejected { output } if output.contains("a.txt")),
        "{error:?}"
    );
    assert_eq!(current_branch(&fixture), "old");
    fixture.git(&["checkout", "--", "a.txt"]);

    let second = fixture.git(&["rev-parse", "main"]);
    switch_detached(&git(), &fixture.path(), &second, &cancel())
        .await
        .unwrap();
    assert_eq!(current_branch(&fixture), "");
    assert_eq!(fixture.git(&["rev-parse", "HEAD"]), second);
}

#[tokio::test]
async fn renames_a_branch_with_its_config() {
    let fixture = two_commits();
    fixture.git(&["branch", "old"]);
    fixture.git(&["config", "branch.old.description", "kept"]);
    let tip = id(&fixture.git(&["rev-parse", "old"]));
    check_ref(&repo(&fixture), "refs/heads/old", tip).unwrap();
    rename_branch(&git(), &fixture.path(), "old", "new", &cancel())
        .await
        .unwrap();
    assert_eq!(fixture.git(&["branch", "--list", "new"]), "new");
    assert_eq!(fixture.git(&["config", "branch.new.description"]), "kept");
    // The old name is gone, so a second look fails.
    assert!(matches!(
        check_ref(&repo(&fixture), "refs/heads/old", tip),
        Err(BranchError::Moved { .. })
    ));
}

#[tokio::test]
async fn counts_the_commits_only_a_branch_holds_then_deletes_it() {
    let fixture = two_commits();
    fixture.git(&["switch", "--quiet", "-c", "topic"]);
    fs::write(fixture.path().join("b.txt"), "b\n").unwrap();
    fixture.git(&["add", "b.txt"]);
    fixture.commit("topic one");
    fs::write(fixture.path().join("b.txt"), "bb\n").unwrap();
    fixture.git(&["add", "b.txt"]);
    let newest = fixture.commit("topic two");
    fixture.git(&["switch", "--quiet", "main"]);
    fixture.git(&["branch", "merged", "HEAD~1"]);
    let head = Some(id(&fixture.git(&["rev-parse", "HEAD"])));

    let topic = id(&fixture.git(&["rev-parse", "topic"]));
    let unique = unique_commits(
        &git(),
        &fixture.path(),
        RefNamespace::Branch,
        "topic",
        topic,
        head,
        &cancel(),
    )
    .await
    .unwrap();
    assert_eq!(unique.count, 2);
    assert_eq!(unique.newest.len(), 2);
    assert_eq!(unique.newest[0].0, topic.to_string());
    assert_eq!(unique.newest[0].1, "topic two");
    assert_eq!(newest, topic.to_string());

    let merged = id(&fixture.git(&["rev-parse", "merged"]));
    let none = unique_commits(
        &git(),
        &fixture.path(),
        RefNamespace::Branch,
        "merged",
        merged,
        head,
        &cancel(),
    )
    .await
    .unwrap();
    assert_eq!(none.count, 0);
    assert!(none.newest.is_empty());

    // A tag on the branch keeps its commits.
    fixture.git(&["tag", "keep", "topic"]);
    let tagged = unique_commits(
        &git(),
        &fixture.path(),
        RefNamespace::Branch,
        "topic",
        topic,
        head,
        &cancel(),
    )
    .await
    .unwrap();
    assert_eq!(tagged.count, 0);

    delete_branch(&git(), &fixture.path(), "topic", &cancel())
        .await
        .unwrap();
    assert_eq!(fixture.git(&["branch", "--list", "topic"]), "");
    // git refuses to delete the branch that is checked out.
    let error = delete_branch(&git(), &fixture.path(), "main", &cancel())
        .await
        .unwrap_err();
    assert!(matches!(error, BranchError::Rejected { .. }));
}

#[tokio::test]
async fn creates_and_deletes_lightweight_and_annotated_tags() {
    let fixture = two_commits();
    let first = fixture.git(&["rev-parse", "HEAD~1"]);
    create_tag(&git(), &fixture.path(), "v1", &first, None, &cancel())
        .await
        .unwrap();
    assert_eq!(fixture.git(&["cat-file", "-t", "v1"]), "commit");

    create_tag(
        &git(),
        &fixture.path(),
        "v2",
        "main",
        Some("  Release two\n\n- first line  "),
        &cancel(),
    )
    .await
    .unwrap();
    assert_eq!(fixture.git(&["cat-file", "-t", "v2"]), "tag");
    assert_eq!(
        fixture.git(&["tag", "--list", "--format=%(contents)", "v2"]),
        "Release two\n\n- first line"
    );
    // An annotated tag is checked against the commit it points to.
    let main = id(&fixture.git(&["rev-parse", "main"]));
    check_ref(&repo(&fixture), "refs/tags/v2", main).unwrap();

    let error = create_tag(&git(), &fixture.path(), "v1", "main", None, &cancel())
        .await
        .unwrap_err();
    assert!(matches!(error, BranchError::Rejected { .. }));

    delete_tag(&git(), &fixture.path(), "v2", &cancel())
        .await
        .unwrap();
    assert_eq!(fixture.git(&["tag", "--list"]), "v1");
}
