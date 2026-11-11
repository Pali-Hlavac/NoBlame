//! Git LFS files with their content, and what an LFS command without a server says.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::lfs::{LfsError, lfs_locks, lfs_state};
use support::Fixture;
use tokio_util::sync::CancellationToken;

#[tokio::test]
async fn lists_lfs_files_when_git_lfs_is_installed() {
    let (git, cancel) = (Git::locate().unwrap(), CancellationToken::new());
    let fixture = Fixture::new();
    let dir = fixture.path();
    let state = lfs_state(&git, &dir, &cancel).await.unwrap();
    if state.version.is_none() {
        // git-lfs is not installed here: nothing more to check.
        return;
    }
    assert!(state.files.is_empty());
    fixture.git(&["lfs", "install", "--local"]);
    fixture.git(&["lfs", "track", "*.bin"]);
    fs::write(dir.join("big.bin"), [0u8, 1, 2, 3].repeat(256)).unwrap();
    fixture.git(&["add", "."]);
    fixture.commit("Add a binary");
    let state = lfs_state(&git, &dir, &cancel).await.unwrap();
    assert_eq!(state.total, 1);
    assert_eq!(state.files[0].path, "big.bin");
    assert!(state.files[0].has_content);
    assert_eq!(state.files[0].oid.len(), 64);
    // No remote, so no LFS server: git-lfs says why.
    let locks = lfs_locks(&git, &dir, &cancel).await;
    assert!(matches!(locks, Err(LfsError::Rejected { .. }) | Ok(_)));
}
