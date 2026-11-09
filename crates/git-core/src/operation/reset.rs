//! `git reset <mode> <commit>`: moving the current branch (or a detached HEAD) to a commit.

use std::path::Path;

use tokio_util::sync::CancellationToken;

use super::OperationError;
use crate::cli::Git;

/// What a reset does with the index and the working tree.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResetMode {
    /// Only the branch moves; the changes of the commits left behind stay staged.
    Soft,
    /// The branch moves and the index follows; the changes stay in the files, unstaged.
    Mixed,
    /// The branch, the index and the tracked files all match the commit: uncommitted changes
    /// to tracked files are lost. Untracked files stay.
    Hard,
    /// Like hard, but uncommitted changes are kept; git refuses when the commit changes a file
    /// that has them.
    Keep,
}

/// Resets the current branch in `work_dir` to `commit`. Returns what git printed (`HEAD is now
/// at ...` for hard and keep).
pub async fn reset(
    git: &Git,
    work_dir: &Path,
    commit: &str,
    mode: ResetMode,
    cancel: &CancellationToken,
) -> Result<String, OperationError> {
    let flag = match mode {
        ResetMode::Soft => "--soft",
        ResetMode::Mixed => "--mixed",
        ResetMode::Hard => "--hard",
        ResetMode::Keep => "--keep",
    };
    let output = git
        .command()
        .current_dir(work_dir)
        .args(["reset", flag])
        .revision(commit)?
        .output(cancel)
        .await?;
    if output.success() {
        Ok(output.combined())
    } else {
        Err(OperationError::Rejected {
            output: output.combined(),
        })
    }
}
