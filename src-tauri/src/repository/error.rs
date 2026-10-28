//! Repository errors and their mapping to [`AppError`].

use git_core::graph::GraphError;
use git_core::repo::RepoError;
use git_core::stash::StashError;
use git_core::submodule::SubmoduleError;

use crate::error::{AppError, ErrorCode};
use crate::git_env::GitEnvError;
use crate::storage::StorageError;

/// Failures of repository commands.
#[derive(Debug, thiserror::Error)]
pub enum RepositoryError {
    /// Opening failed.
    #[error(transparent)]
    Open(#[from] RepoError),
    /// Reading history failed.
    #[error(transparent)]
    Graph(#[from] GraphError),
    /// Reading the stash list failed.
    #[error(transparent)]
    Stash(#[from] StashError),
    /// Listing submodules failed.
    #[error(transparent)]
    Submodule(#[from] SubmoduleError),
    /// Running git failed.
    #[error(transparent)]
    Git(#[from] GitEnvError),
    /// The recent-repositories file could not be read or written.
    #[error(transparent)]
    Storage(#[from] StorageError),
    /// No open repository has this id (the tab was closed).
    #[error("repository session {0} is not open")]
    UnknownSession(u32),
    /// A background task panicked or was cancelled.
    #[error("background task failed: {0}")]
    Task(String),
}

impl From<RepositoryError> for AppError {
    fn from(error: RepositoryError) -> Self {
        match error {
            RepositoryError::Open(RepoError::NotARepository { path }) => AppError::new(
                ErrorCode::NotARepository,
                format!("{} is not a Git repository.", path.display()),
            )
            .with_hint("Choose the folder that contains the repository, or create one there."),
            RepositoryError::Open(RepoError::Untrusted { path }) => AppError::new(
                ErrorCode::UntrustedRepository,
                format!(
                    "Git does not trust the repository at {}: it belongs to another user.",
                    path.display()
                ),
            )
            .with_hint(format!(
                "If you trust it, run `git config --global --add safe.directory \"{}\"` in a terminal. NoBlame never changes this setting itself.",
                path.display()
            )),
            RepositoryError::Open(RepoError::Gix(message))
            | RepositoryError::Graph(GraphError::Gix(message))
            | RepositoryError::Stash(StashError::Gix(message))
            | RepositoryError::Submodule(SubmoduleError::Gix(message)) => {
                tracing::error!(%message, "repository read failed");
                AppError::new(ErrorCode::GitFailed, format!("Reading the repository failed: {message}"))
            }
            RepositoryError::Graph(error @ GraphError::RowOutOfRange { .. }) => {
                AppError::new(ErrorCode::InvalidInput, error.to_string())
            }
            RepositoryError::Git(error) => error.into(),
            RepositoryError::Storage(error) => error.into(),
            RepositoryError::UnknownSession(_) => AppError::new(
                ErrorCode::NotFound,
                "This repository is no longer open.",
            )
            .with_hint("Open it again."),
            RepositoryError::Task(message) => {
                tracing::error!(%message, "background task failed");
                AppError::new(ErrorCode::Internal, "An internal task failed.")
            }
        }
    }
}
