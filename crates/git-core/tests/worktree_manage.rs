//! Listing, adding, locking, removing and pruning worktrees.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use git_core::cli::Git;
use git_core::worktree::{
    AddWorktree, WorktreeCheckout, add_worktree, list_worktrees, lock_worktree, prune_worktrees,
    remove_worktree, unlock_worktree,
};
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn git() -> Git {
    Git::locate().expect("tests need git on PATH")
}

#[tokio::test]
async fn worktrees_are_added_listed_locked_and_removed() {
    let fixture = Fixture::new();
    let first = fixture.commit("base");
    let (git, dir, cancel) = (git(), fixture.path(), CancellationToken::new());
    let topic = fixture.sibling("topic");
    let detached = fixture.sibling("detached");
    let add = |folder: &std::path::Path, checkout| AddWorktree {
        folder: folder.to_owned(),
        checkout,
    };
    let new_branch = WorktreeCheckout::NewBranch {
        name: "topic".into(),
        start: "main".into(),
    };
    add_worktree(&git, &dir, &add(&topic, new_branch), &cancel)
        .await
        .unwrap();
    let detach = WorktreeCheckout::Detached(first.clone());
    add_worktree(&git, &dir, &add(&detached, detach), &cancel)
        .await
        .unwrap();
    // `main` is checked out in the main worktree: git refuses it in another.
    let again = WorktreeCheckout::Branch("main".into());
    let refused = add_worktree(&git, &dir, &add(&fixture.sibling("x"), again), &cancel).await;
    assert!(refused.is_err());

    lock_worktree(&git, &dir, &detached, "on a stick", &cancel)
        .await
        .unwrap();
    let listed = list_worktrees(&git, &dir, &cancel).await.unwrap();
    assert_eq!(listed.len(), 3);
    assert!(listed[0].main);
    assert_eq!(listed[0].branch.as_deref(), Some("main"));
    let wt = |name: &str| {
        let path = fixture.sibling(name).canonicalize().unwrap();
        listed
            .iter()
            .find(|each| each.path.canonicalize().unwrap() == path)
            .cloned()
            .unwrap()
    };
    assert_eq!(wt("topic").branch.as_deref(), Some("topic"));
    assert!(wt("detached").detached);
    assert_eq!(wt("detached").head.as_deref(), Some(first.as_str()));
    assert_eq!(wt("detached").locked.as_deref(), Some("on a stick"));

    // Locked: refused even with force.
    assert!(
        remove_worktree(&git, &dir, &detached, true, &cancel)
            .await
            .is_err()
    );
    unlock_worktree(&git, &dir, &detached, &cancel)
        .await
        .unwrap();
    // A changed file: refused without force.
    std::fs::write(topic.join("new.txt"), "x").unwrap();
    assert!(
        remove_worktree(&git, &dir, &topic, false, &cancel)
            .await
            .is_err()
    );
    remove_worktree(&git, &dir, &topic, true, &cancel)
        .await
        .unwrap();
    assert!(!topic.exists());

    // A folder deleted by hand is prunable until pruned.
    std::fs::remove_dir_all(&detached).unwrap();
    let listed = list_worktrees(&git, &dir, &cancel).await.unwrap();
    assert!(listed[1].prunable.is_some());
    prune_worktrees(&git, &dir, &cancel).await.unwrap();
    assert_eq!(list_worktrees(&git, &dir, &cancel).await.unwrap().len(), 1);
}

#[tokio::test]
async fn a_folder_with_files_is_refused() {
    let fixture = Fixture::new();
    fixture.commit("base");
    let folder = fixture.sibling("full");
    std::fs::create_dir_all(&folder).unwrap();
    std::fs::write(folder.join("a"), "a").unwrap();
    let request = AddWorktree {
        folder,
        checkout: WorktreeCheckout::Detached("HEAD".into()),
    };
    let error = add_worktree(&git(), &fixture.path(), &request, &CancellationToken::new())
        .await
        .unwrap_err();
    assert!(error.to_string().contains("is not empty"));
}
