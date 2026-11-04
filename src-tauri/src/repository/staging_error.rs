//! What a refused stage, unstage, discard or commit tells the user.

use git_core::commit::CommitError;

use super::RepositoryError;
use super::error::read_failed;
use crate::error::{AppError, ErrorCode};
use crate::git_env::GitEnvError;

/// The message for staging and committing errors: what git and its hooks printed, or why
/// NoBlame did not run git.
pub(super) fn staging_error(error: RepositoryError) -> AppError {
    match error {
        RepositoryError::Commit(error) => commit_error(error),
        RepositoryError::Bare => AppError::new(
            ErrorCode::InvalidInput,
            "This repository is bare: it has no working tree to stage or commit.",
        ),
        RepositoryError::LossyPath(path) => AppError::new(
            ErrorCode::InvalidInput,
            format!(
                "The name of {path} is not valid UTF-8, so NoBlame cannot pass it back to Git."
            ),
        )
        .with_hint("Stage this file with git in a terminal, or use Stage all."),
        other => AppError::new(ErrorCode::Internal, other.to_string()),
    }
}

fn commit_error(error: CommitError) -> AppError {
    match error {
        CommitError::Git(error) => GitEnvError::from(error).into(),
        CommitError::Rejected { output } => AppError::new(ErrorCode::GitFailed, output),
        CommitError::Gix(message) => read_failed(&message),
        CommitError::Changed(path) => AppError::new(
            ErrorCode::NotFound,
            format!("{path} changed since its diff was shown, so nothing was changed."),
        )
        .with_hint("The diff now shows it as it is; choose the lines again."),
        CommitError::InvalidAuthor(author) => AppError::new(
            ErrorCode::InvalidInput,
            format!("The author “{author}” is not written as Name <email>."),
        ),
        CommitError::Conflicted(path) => AppError::new(
            ErrorCode::InvalidInput,
            format!("{path} has merge conflicts; stage it whole once they are resolved."),
        ),
        CommitError::Diff(error) => RepositoryError::Diff(error).into(),
        CommitError::Write { path, source } => {
            tracing::warn!(path = %path.display(), %source, "writing a working tree file failed");
            AppError::new(
                ErrorCode::Io,
                format!("Could not write {}: {source}.", path.display()),
            )
            .with_hint("Close any program that holds the file open, then try again.")
        }
    }
}
