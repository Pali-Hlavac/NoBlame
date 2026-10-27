//! Opening repositories of every kind with `git_core::repo`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use git_core::repo::{Head, RepoError, RepoKind, Repository};
use support::Fixture;

#[test]
fn opens_a_normal_repository_from_a_subfolder() {
    let fixture = Fixture::new();
    fixture.commit("first");
    let nested = fixture.path().join("src").join("deep");
    std::fs::create_dir_all(&nested).unwrap();

    let repo = Repository::discover(&nested).unwrap();
    let info = repo.info();
    assert_eq!(info.kind, RepoKind::Normal);
    assert_eq!(info.head, Head::Branch("main".into()));
    assert!(info.work_dir.as_ref().unwrap().ends_with("repo"));
    assert!(!info.is_shallow);
    assert!(!info.has_commit_graph);
}

#[test]
fn a_new_repository_has_an_unborn_branch() {
    let fixture = Fixture::new();
    let repo = Repository::discover(&fixture.path()).unwrap();
    assert_eq!(repo.info().head, Head::Unborn("main".into()));
}

#[test]
fn detects_bare_repositories() {
    let fixture = Fixture::bare();
    let repo = Repository::discover(&fixture.path()).unwrap();
    assert_eq!(repo.info().kind, RepoKind::Bare);
    assert_eq!(repo.info().work_dir, None);
}

#[test]
fn detects_linked_worktrees_and_their_branch() {
    let fixture = Fixture::new();
    fixture.commit("first");
    let worktree = fixture.sibling("wt");
    let worktree_arg = worktree.to_string_lossy().into_owned();
    fixture.git(&["worktree", "add", "--quiet", "-b", "feature", &worktree_arg]);

    let repo = Repository::discover(&worktree).unwrap();
    assert_eq!(repo.info().kind, RepoKind::LinkedWorktree);
    assert_eq!(repo.info().head, Head::Branch("feature".into()));
}

#[test]
fn reports_a_detached_head_with_its_id() {
    let fixture = Fixture::new();
    let first = fixture.commit("first");
    fixture.commit("second");
    fixture.git(&["checkout", "--quiet", "--detach", &first]);
    let repo = Repository::discover(&fixture.path()).unwrap();
    assert_eq!(repo.info().head, Head::Detached(first));
}

#[test]
fn detects_shallow_clones_and_the_commit_graph() {
    let fixture = Fixture::new();
    fixture.commit("first");
    fixture.commit("second");
    fixture.git(&["commit-graph", "write", "--reachable"]);
    assert!(
        Repository::discover(&fixture.path())
            .unwrap()
            .info()
            .has_commit_graph
    );

    let source = format!(
        "file://{}",
        fixture.path().to_string_lossy().replace('\\', "/")
    );
    let target = fixture.sibling("shallow").to_string_lossy().into_owned();
    fixture.run(
        &fixture.sibling(""),
        &["clone", "--quiet", "--depth", "1", &source, &target],
    );
    let shallow = Repository::discover(&fixture.sibling("shallow")).unwrap();
    assert!(shallow.info().is_shallow);
}

#[test]
fn a_plain_folder_is_not_a_repository() {
    let dir = tempfile::tempdir().unwrap();
    let error = Repository::discover(dir.path()).unwrap_err();
    assert!(
        matches!(error, RepoError::NotARepository { .. }),
        "{error:?}"
    );
}
