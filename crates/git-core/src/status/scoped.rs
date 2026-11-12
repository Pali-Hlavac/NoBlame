//! The status of one folder or file (a task window opened on it, `noblame commit src/`):
//! `git status` only looks there, which keeps it fast in huge working trees.

use std::path::Path;

use gix::bstr::ByteSlice;
use tokio_util::sync::CancellationToken;

use super::{StatusError, UntrackedFiles, WorkingTreeStatus, read_status};
use crate::cli::Git;

/// The status of `scope` (relative to the top, with `/`; a folder or a file) only. The
/// summary counts the files there.
pub async fn working_tree_status_in(
    git: &Git,
    work_dir: &Path,
    untracked: UntrackedFiles,
    scope: &str,
    cancel: &CancellationToken,
) -> Result<WorkingTreeStatus, StatusError> {
    read_status(git, work_dir, untracked, Some(scope), cancel).await
}

/// How many staged files lie outside `scope`: a commit takes them too. Compares the index with
/// `HEAD` only (`git diff --cached`), without looking at the working tree.
pub async fn staged_outside(
    git: &Git,
    work_dir: &Path,
    scope: &str,
    cancel: &CancellationToken,
) -> Result<usize, StatusError> {
    let output = git
        .command()
        .current_dir(work_dir)
        .read_only()
        .args(["diff", "--cached", "--name-only", "--no-renames", "-z"])
        .run(cancel)
        .await?;
    let inside = |path: &[u8]| {
        path == scope.as_bytes()
            || path
                .strip_prefix(scope.as_bytes())
                .is_some_and(|rest| rest.starts_with(b"/"))
    };
    Ok(output
        .stdout
        .split_str(b"\0")
        .filter(|path| !path.is_empty() && !inside(path))
        .count())
}
