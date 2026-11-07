//! What a refused checkout, a branch, tag or remote that could not be created, renamed or
//! deleted, or a clone that could not start, tells the user.

use git_core::branch::BranchError;
use git_core::remote::CloneError;

use super::error::read_failed;
use crate::error::{AppError, ErrorCode};
use crate::git_env::GitEnvError;

/// What git prints when local changes are in the way of a checkout.
const OVERWRITTEN: &str = "would be overwritten";

/// The message for branch and tag errors: what git printed, or why NoBlame did not run it.
pub(super) fn branch_error(error: BranchError) -> AppError {
    match error {
        BranchError::Gix(message) => read_failed(&message),
        BranchError::Git(error) => GitEnvError::from(error).into(),
        BranchError::Rejected { output } => {
            let hint = output.contains(OVERWRITTEN).then_some(
                "Commit or stash those changes first (Commit module, or Stashes), then try again.",
            );
            let error = AppError::new(ErrorCode::GitFailed, output);
            match hint {
                Some(hint) => error.with_hint(hint),
                None => error,
            }
        }
        BranchError::InvalidName { name, reason } => AppError::new(
            ErrorCode::InvalidInput,
            format!("“{name}” cannot be used as a name: {reason}."),
        ),
        BranchError::InvalidUrl { reason } => AppError::new(
            ErrorCode::InvalidInput,
            format!("This URL cannot be used: {reason}."),
        )
        .with_hint("Use the address you would give `git clone`: https://…, git@host:path, or a folder."),
        BranchError::Moved { name } => AppError::new(
            ErrorCode::NotFound,
            format!("{name} changed since it was shown, so nothing was done."),
        )
        .with_hint("The graph and the Branches module show it as it is now; try again there."),
        BranchError::Detached => AppError::new(
            ErrorCode::InvalidInput,
            "HEAD is not on a branch, so there is nothing to push.",
        )
        .with_hint("Check out a branch first, or push a commit with Push… on a branch."),
        BranchError::NoRemoteUpstream { branch } => AppError::new(
            ErrorCode::InvalidInput,
            format!("{branch} has no upstream on a remote, so Push does not know where to send it."),
        )
        .with_hint("With the repository active, choose Push… (beside Push in the toolbar) to pick the remote and make it the upstream."),
        error @ BranchError::Parse(_) => {
            tracing::error!(%error, "rev-list output not understood");
            AppError::new(
                ErrorCode::GitFailed,
                format!("Counting the commits failed: {error}"),
            )
        }
    }
}

/// Why a clone could not start.
pub(super) fn clone_error(error: CloneError) -> AppError {
    let new_folder = "Clone into a new folder, or an empty one.";
    match error {
        CloneError::Invalid(error) => branch_error(error),
        CloneError::Git(error) => GitEnvError::from(error).into(),
        CloneError::Relative(path) => AppError::new(
            ErrorCode::InvalidInput,
            format!("{} is not a full path.", path.display()),
        )
        .with_hint("Choose the folder with Browse…, or write it from the drive or root on."),
        CloneError::NotEmpty(path) => AppError::new(
            ErrorCode::InvalidInput,
            format!("{} already exists and is not empty.", path.display()),
        )
        .with_hint(new_folder),
        CloneError::NotAFolder(path) => AppError::new(
            ErrorCode::InvalidInput,
            format!("{} is a file.", path.display()),
        )
        .with_hint(new_folder),
        CloneError::Io { path, source } => AppError::new(
            ErrorCode::Io,
            format!("Could not use {}: {source}.", path.display()),
        )
        .with_hint("Choose a folder you can write to."),
    }
}
