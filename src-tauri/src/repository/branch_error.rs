//! What a refused checkout, or a branch or tag that could not be created, renamed or deleted,
//! tells the user.

use git_core::branch::BranchError;

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
