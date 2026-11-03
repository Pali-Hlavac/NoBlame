//! Staging and unstaging files (`git add`, `git reset`).

use std::path::Path;

use tokio_util::sync::CancellationToken;

use super::{CommitError, accepted};
use crate::cli::{Git, GitCommand};

/// Stages `paths` as they are in the working tree: changes, new files and deletions
/// (`git add --all`). Staging a conflicted file marks it resolved.
pub async fn stage_paths(
    git: &Git,
    work_dir: &Path,
    paths: &[impl AsRef<[u8]>],
    cancel: &CancellationToken,
) -> Result<(), CommitError> {
    if paths.is_empty() {
        return Ok(());
    }
    let command = git.command().current_dir(work_dir).args(["add", "--all"]);
    run(with_paths(command, paths), cancel).await
}

/// Stages every change in the working tree (`git add --all`).
pub async fn stage_all(
    git: &Git,
    work_dir: &Path,
    cancel: &CancellationToken,
) -> Result<(), CommitError> {
    let command = git.command().current_dir(work_dir).args(["add", "--all"]);
    run(command, cancel).await
}

/// Puts `paths` in the index back as they are in `HEAD` (`git reset -- <paths>`); the working
/// tree is not touched. On a branch without commits they are removed from the index. A
/// rename needs both its names.
pub async fn unstage_paths(
    git: &Git,
    work_dir: &Path,
    paths: &[impl AsRef<[u8]>],
    cancel: &CancellationToken,
) -> Result<(), CommitError> {
    if paths.is_empty() {
        return Ok(());
    }
    let command = git
        .command()
        .current_dir(work_dir)
        .args(["reset", "--quiet"]);
    run(with_paths(command, paths), cancel).await
}

/// Unstages everything (`git reset -- .`). Limited to paths, so a merge in progress is kept
/// (a plain `git reset` would forget it).
pub async fn unstage_all(
    git: &Git,
    work_dir: &Path,
    cancel: &CancellationToken,
) -> Result<(), CommitError> {
    let command = git
        .command()
        .current_dir(work_dir)
        .args(["reset", "--quiet"])
        .paths(["."]);
    run(command, cancel).await
}

/// Passes `paths` (bytes: names may be non-UTF-8) on standard input, NUL-separated and read
/// literally.
fn with_paths(command: GitCommand, paths: &[impl AsRef<[u8]>]) -> GitCommand {
    let mut input = Vec::with_capacity(paths.iter().map(|path| path.as_ref().len() + 1).sum());
    for path in paths {
        input.extend_from_slice(path.as_ref());
        input.push(0);
    }
    command
        .literal_pathspecs()
        .args(["--pathspec-from-file=-", "--pathspec-file-nul"])
        .stdin(input)
}

async fn run(command: GitCommand, cancel: &CancellationToken) -> Result<(), CommitError> {
    accepted(&command.output(cancel).await?).map(drop)
}
