//! What a refused stage, unstage, discard, commit, stash or ignore tells the user, and why an
//! external diff tool did not open.

use git_core::commit::CommitError;
use git_core::difftool::DiffToolError;
use git_core::ignore::IgnoreError;
use git_core::stash::StashError;

use super::RepositoryError;
use super::error::read_failed;
use crate::error::{AppError, ErrorCode};
use crate::git_env::GitEnvError;

/// The message for staging and committing errors: what git and its hooks printed, or why
/// NoBlame did not run git.
pub(super) fn staging_error(error: RepositoryError) -> AppError {
    match error {
        RepositoryError::Commit(error) => commit_error(error),
        RepositoryError::Stash(error) => stash_error(error),
        RepositoryError::Ignore(error) => ignore_error(error),
        RepositoryError::DiffTool(error) => diff_tool_error(error),
        RepositoryError::Bare => AppError::new(
            ErrorCode::InvalidInput,
            "This repository is bare: it has no working tree.",
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

fn diff_tool_error(error: DiffToolError) -> AppError {
    const SETTINGS_HINT: &str = "Choose the diff tool in Settings → Diff.";
    match error {
        DiffToolError::NotConfigured => AppError::new(
            ErrorCode::InvalidInput,
            "Git has no diff tool set (diff.tool).",
        )
        .with_hint("Choose Visual Studio Code or a command of your own in Settings → Diff, or set diff.tool in your Git config."),
        DiffToolError::NoCommand => AppError::new(
            ErrorCode::InvalidInput,
            "The diff tool command in Settings → Diff is empty.",
        ),
        DiffToolError::Failed { output } => {
            AppError::new(ErrorCode::GitFailed, output).with_hint(SETTINGS_HINT)
        }
        DiffToolError::InvalidPath(path) => AppError::new(
            ErrorCode::InvalidInput,
            format!("{path} cannot be written as a file on this system."),
        ),
        DiffToolError::Git(error) => GitEnvError::from(error).into(),
        DiffToolError::Write { path, source } => AppError::new(
            ErrorCode::Io,
            format!("Could not write {}: {source}.", path.display()),
        ),
    }
}

fn ignore_error(error: IgnoreError) -> AppError {
    match error {
        IgnoreError::Invalid(reason) => AppError::new(ErrorCode::InvalidInput, reason),
        IgnoreError::Bare => staging_error(RepositoryError::Bare),
        IgnoreError::Git(error) => GitEnvError::from(error).into(),
        IgnoreError::Write { path, source } => AppError::new(
            ErrorCode::Io,
            format!("Could not write {}: {source}.", path.display()),
        )
        .with_hint("Close any program that holds the file open, then try again."),
    }
}

fn stash_error(error: StashError) -> AppError {
    match error {
        StashError::Gix(message) => read_failed(&message),
        StashError::Git(error) => GitEnvError::from(error).into(),
        StashError::Rejected { output } => AppError::new(ErrorCode::GitFailed, output),
        StashError::NothingToStash => AppError::new(
            ErrorCode::InvalidInput,
            "There are no changes to stash in the chosen files.",
        ),
        StashError::Moved { index } => AppError::new(
            ErrorCode::NotFound,
            format!("stash@{{{index}}} changed since the list was shown, so nothing was done."),
        )
        .with_hint("The list shows the stashes as they are now; choose the stash again."),
        StashError::Diff(error) => RepositoryError::Diff(error).into(),
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
