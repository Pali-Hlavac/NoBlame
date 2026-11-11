//! Repository errors and their mapping to [`AppError`].

use git_core::blame::BlameError;
use git_core::branch::BranchError;
use git_core::commit::CommitError;
use git_core::compare::CompareError;
use git_core::diff::DiffError;
use git_core::difftool::DiffToolError;
use git_core::graph::GraphError;
use git_core::history::HistoryError;
use git_core::ignore::IgnoreError;
use git_core::lfs::LfsError;
use git_core::patch::PatchError;
use git_core::remote::CloneError;
use git_core::repo::RepoError;
use git_core::script::ScriptError;
use git_core::signing::SigningError;
use git_core::stash::StashError;
use git_core::status::StatusError;
use git_core::submodule::SubmoduleError;
use git_core::tree::TreeError;

use super::staging_error::staging_error;
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
    /// Blaming a file failed.
    #[error(transparent)]
    Blame(#[from] BlameError),
    /// Reading a file's history failed.
    #[error(transparent)]
    History(#[from] HistoryError),
    /// Comparing two revisions failed.
    #[error(transparent)]
    Compare(#[from] CompareError),
    /// Reading the working tree status failed.
    #[error(transparent)]
    Status(#[from] StatusError),
    /// Staging or committing failed.
    #[error(transparent)]
    Commit(#[from] CommitError),
    /// A user script cannot run (its command line, a placeholder).
    #[error(transparent)]
    Script(#[from] ScriptError),
    /// No user script has this name (any more).
    #[error("there is no script named {0}")]
    NoScript(String),
    /// A Git LFS command failed.
    #[error(transparent)]
    Lfs(#[from] LfsError),
    /// Creating, checking or applying patches, or an archive, failed.
    #[error(transparent)]
    Patch(#[from] PatchError),
    /// Checking out, or changing a branch or tag, failed.
    #[error(transparent)]
    Branch(#[from] BranchError),
    /// A clone could not start (the folder is not empty, the URL cannot be used).
    #[error(transparent)]
    Clone(#[from] CloneError),
    /// Opening an external diff tool failed.
    #[error(transparent)]
    DiffTool(#[from] DiffToolError),
    /// Ignoring files (or previewing it) failed.
    #[error(transparent)]
    Ignore(#[from] IgnoreError),
    /// Checking a commit's signature failed.
    #[error(transparent)]
    Signing(#[from] SigningError),
    /// Running git failed.
    #[error(transparent)]
    Git(#[from] GitEnvError),
    /// The recent-repositories file could not be read or written.
    #[error(transparent)]
    Storage(#[from] StorageError),
    /// The repository is bare, so it has no files to stage or commit.
    #[error("the repository has no working tree")]
    Bare,
    /// A path came back from the UI with characters replaced (its name is not UTF-8).
    #[error("the path {0:?} is not valid UTF-8")]
    LossyPath(String),
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
            RepositoryError::Open(error) => open_error(error),
            RepositoryError::Graph(GraphError::Gix(message))
            | RepositoryError::Stash(StashError::Gix(message))
            | RepositoryError::Submodule(SubmoduleError::Gix(message))
            | RepositoryError::Diff(DiffError::Gix(message))
            | RepositoryError::Tree(TreeError::Gix(message))
            | RepositoryError::History(HistoryError::Gix(message))
            | RepositoryError::Signing(SigningError::Gix(message)) => read_failed(&message),
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
            RepositoryError::Diff(DiffError::Changed(path)) => AppError::new(
                ErrorCode::NotFound,
                format!("{path} changed in the working tree while it was being read."),
            )
            .with_hint("Try again to show the new version."),
            RepositoryError::Diff(DiffError::Missing(_))
            | RepositoryError::Tree(TreeError::Missing(_)) => AppError::new(
                ErrorCode::NotFound,
                "This version of the file is not in the local repository.",
            )
            .with_hint(
                "Partial clones (`git clone --filter=blob:none`) download old file contents only when Git needs them. NoBlame does not download them yet.",
            ),
            RepositoryError::Status(StatusError::Git(error))
            | RepositoryError::History(HistoryError::Git(error))
            | RepositoryError::Blame(BlameError::Git(error))
            | RepositoryError::Signing(SigningError::Git(error))
            | RepositoryError::Submodule(SubmoduleError::Git(error)) => GitEnvError::from(error).into(),
            RepositoryError::Submodule(error @ SubmoduleError::InvalidPath(_)) => {
                AppError::new(ErrorCode::InvalidInput, format!("{}.", capitalized(&error.to_string())))
            }
            RepositoryError::Compare(error) => compare_error(error),
            RepositoryError::Patch(error) => crate::patches::patch_error(error),
            RepositoryError::Lfs(error) => crate::lfs::lfs_error(error),
            error @ (RepositoryError::Script(_) | RepositoryError::NoScript(_)) => script_error(&error),
            RepositoryError::Branch(error) => super::branch_error::branch_error(error),
            RepositoryError::Clone(error) => super::branch_error::clone_error(error),
            error @ (RepositoryError::Commit(_)
            | RepositoryError::Ignore(_)
            | RepositoryError::DiffTool(_)
            | RepositoryError::Stash(_)
            | RepositoryError::Bare
            | RepositoryError::LossyPath(_)) => staging_error(error),
            RepositoryError::Blame(error @ BlameError::Parse(_)) => {
                tracing::error!(%error, "blame output not understood");
                AppError::new(ErrorCode::GitFailed, format!("Reading the blame failed: {error}"))
            }
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

/// What a user script that cannot run tells the user.
fn script_error(error: &RepositoryError) -> AppError {
    match error {
        RepositoryError::NoScript(name) => AppError::new(
            ErrorCode::NotFound,
            format!("There is no script named {name} any more."),
        ),
        _ => AppError::new(ErrorCode::InvalidInput, error.to_string())
            .with_hint("Change the script in Settings → Scripts."),
    }
}

/// What a failed comparison tells the user.
fn compare_error(error: CompareError) -> AppError {
    match error {
        CompareError::Diff(error) => RepositoryError::Diff(error).into(),
        CompareError::Git(error) => GitEnvError::from(error).into(),
        CompareError::Gix(message) => read_failed(&message),
        CompareError::NoMergeBase => AppError::new(
            ErrorCode::InvalidInput,
            "These commits share no history, so there is no point where they split.",
        )
        .with_hint("Compare them directly instead."),
        error @ CompareError::Parse(_) => {
            tracing::error!(%error, "rev-list output not understood");
            AppError::new(
                ErrorCode::GitFailed,
                format!("Counting the commits failed: {error}"),
            )
        }
    }
}

/// What a failed open tells the user.
fn open_error(error: RepoError) -> AppError {
    match error {
        RepoError::NotARepository { path } => AppError::new(
            ErrorCode::NotARepository,
            format!("{} is not a Git repository.", path.display()),
        )
        .with_hint("Choose the folder that contains the repository, or create one there."),
        RepoError::Untrusted { path } => AppError::new(
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
        RepoError::Gix(message) => read_failed(&message),
    }
}

/// A gix read failed: logged, and shown with its message.
pub(super) fn read_failed(message: &str) -> AppError {
    tracing::error!(%message, "repository read failed");
    AppError::new(
        ErrorCode::GitFailed,
        format!("Reading the repository failed: {message}"),
    )
}

/// `text` with its first letter in upper case (error texts start lower case in Rust).
fn capitalized(text: &str) -> String {
    let mut chars = text.chars();
    chars.next().map_or_else(String::new, |first| {
        first.to_uppercase().chain(chars).collect()
    })
}
