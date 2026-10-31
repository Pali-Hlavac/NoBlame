//! Repository errors and their mapping to [`AppError`].

use git_core::diff::DiffError;
use git_core::graph::GraphError;
use git_core::history::HistoryError;
use git_core::repo::RepoError;
use git_core::stash::StashError;
use git_core::status::StatusError;
use git_core::submodule::SubmoduleError;
use git_core::tree::TreeError;

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
    /// Diffing failed.
    #[error(transparent)]
    Diff(#[from] DiffError),
    /// Reading the files of a revision, or saving one, failed.
    #[error(transparent)]
    Tree(#[from] TreeError),
    /// Reading a file's history failed.
    #[error(transparent)]
    History(#[from] HistoryError),
    /// Reading the working tree status failed.
    #[error(transparent)]
    Status(#[from] StatusError),
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
            | RepositoryError::Submodule(SubmoduleError::Gix(message))
            | RepositoryError::Diff(DiffError::Gix(message))
            | RepositoryError::Tree(TreeError::Gix(message))
            | RepositoryError::History(HistoryError::Gix(message)) => {
                tracing::error!(%message, "repository read failed");
                AppError::new(ErrorCode::GitFailed, format!("Reading the repository failed: {message}"))
            }
            RepositoryError::Graph(error @ GraphError::RowOutOfRange { .. }) => {
                AppError::new(ErrorCode::InvalidInput, error.to_string())
            }
            RepositoryError::Graph(error @ GraphError::UnknownRevision(_)) => {
                AppError::new(ErrorCode::NotFound, format!("{}.", capitalized(&error.to_string())))
                    .with_hint("Enter a commit id (at least 4 characters), a branch or tag name, or HEAD~2.")
            }
            RepositoryError::Graph(GraphError::Cancelled) => AppError::new(
                ErrorCode::Cancelled,
                "A newer filter replaced this one before it was ready.",
            ),
            RepositoryError::Diff(
                error @ (DiffError::NoSuchParent(_)
                | DiffError::InvalidId(_)
                | DiffError::NotAFile(_)),
            ) => {
                AppError::new(ErrorCode::InvalidInput, error.to_string())
            }
            RepositoryError::Diff(DiffError::TooLarge { size, limit }) => AppError::new(
                ErrorCode::InvalidInput,
                format!(
                    "The file is too large to preview ({} MB; the limit is {} MB).",
                    size >> 20,
                    limit >> 20
                ),
            ),
            RepositoryError::Tree(TreeError::Write { path, source }) => {
                tracing::warn!(path = %path.display(), %source, "saving a file failed");
                AppError::new(
                    ErrorCode::Io,
                    format!("Could not save {}: {source}.", path.display()),
                )
                .with_hint("Choose a folder you can write to.")
            }
            RepositoryError::Diff(DiffError::Missing(_))
            | RepositoryError::Tree(TreeError::Missing(_)) => AppError::new(
                ErrorCode::NotFound,
                "This version of the file is not in the local repository.",
            )
            .with_hint(
                "Partial clones (`git clone --filter=blob:none`) download old file contents only when Git needs them. NoBlame does not download them yet.",
            ),
            RepositoryError::Status(StatusError::Git(error))
            | RepositoryError::History(HistoryError::Git(error)) => GitEnvError::from(error).into(),
            RepositoryError::Status(error @ StatusError::Parse(_)) => {
                tracing::error!(%error, "status output not understood");
                AppError::new(ErrorCode::GitFailed, format!("Reading the status failed: {error}"))
            }
            RepositoryError::Git(error) => error.into(),
            RepositoryError::Storage(error) => error.into(),
            RepositoryError::UnknownSession(_) => AppError::new(
                ErrorCode::NotFound,
                "This repository is no longer open.",
            )
            .with_hint("Open it again."),
            RepositoryError::Task(message) | RepositoryError::History(HistoryError::Task(message)) => {
                tracing::error!(%message, "background task failed");
                AppError::new(ErrorCode::Internal, "An internal task failed.")
            }
        }
    }
}

/// `text` with its first letter in upper case (error texts start lower case in Rust).
fn capitalized(text: &str) -> String {
    let mut chars = text.chars();
    chars.next().map_or_else(String::new, |first| {
        first.to_uppercase().chain(chars).collect()
    })
}
