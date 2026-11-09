//! Errors of merging and of the operation in progress, and their mapping to [`AppError`]:
//! git's own words, with a plain-language next step when the reason is a known one.

use git_core::operation::OperationError;

use crate::error::{AppError, ErrorCode};
use crate::git_env::GitEnvError;
use crate::repository::RepositoryError;

/// Failures of the operations commands.
#[derive(Debug, thiserror::Error)]
pub enum OperationsError {
    /// The repository is not open, is bare, or could not be read.
    #[error(transparent)]
    Repository(#[from] RepositoryError),
    /// git refused or could not run.
    #[error(transparent)]
    Operation(#[from] OperationError),
}

/// Reasons git gives, and what to do about them.
const HINTS: &[(&str, &str)] = &[
    (
        "would be overwritten",
        "Your uncommitted changes are in the way. Commit or stash them first.",
    ),
    (
        "Not possible to fast-forward",
        "Both branches have new commits. Merge with a merge commit instead.",
    ),
    (
        "unmerged files",
        "Some files still have conflicts. Resolve them and stage them, then continue.",
    ),
    (
        "needs merge",
        "Some files still have conflicts. Resolve them and stage them, then continue.",
    ),
    (
        "not something we can merge",
        "That branch or commit does not exist (any more). Refresh and pick it again.",
    ),
    (
        "unrelated histories",
        "These branches share no history; git refuses to merge them by default.",
    ),
    (
        "You have not concluded your merge",
        "A merge is in progress. Finish it (Continue) or abort it first.",
    ),
    (
        "is already in progress",
        "Another cherry-pick or revert is in progress. Finish it (Continue) or abort it first.",
    ),
    (
        "cannot do a partial commit during",
        "An operation is in progress. Finish it (Continue) or abort it first.",
    ),
    (
        "not uptodate. Cannot merge",
        "Your uncommitted changes touch files this reset changes. Commit or stash them, or reset hard.",
    ),
];

impl From<OperationsError> for AppError {
    fn from(error: OperationsError) -> Self {
        match error {
            OperationsError::Repository(error) => error.into(),
            OperationsError::Operation(OperationError::Git(error)) => {
                GitEnvError::from(error).into()
            }
            OperationsError::Operation(OperationError::NotApplicable(message)) => {
                AppError::new(ErrorCode::InvalidInput, message)
            }
            OperationsError::Operation(OperationError::Rejected { output }) => {
                let hint = HINTS
                    .iter()
                    .find(|(needle, _)| output.contains(needle))
                    .map(|(_, hint)| *hint);
                let error = AppError::new(ErrorCode::GitFailed, output);
                match hint {
                    Some(hint) => error.with_hint(hint),
                    None => error,
                }
            }
        }
    }
}
