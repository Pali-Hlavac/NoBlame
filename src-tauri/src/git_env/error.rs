//! Errors of the git runner and their mapping to [`AppError`].

use std::time::Duration;

use git_core::cli::{GitError, locate::GIT_OVERRIDE_ENV};

use crate::error::{AppError, ErrorCode};

/// Failures while finding or checking git.
#[derive(Debug, thiserror::Error)]
pub enum GitEnvError {
    /// Locating or running git failed.
    #[error(transparent)]
    Git(#[from] GitError),
    /// `git --version` did not finish in time.
    #[error("git did not answer within {0:?}")]
    Timeout(Duration),
}

impl From<GitEnvError> for AppError {
    fn from(error: GitEnvError) -> Self {
        match error {
            GitEnvError::Git(error) => error_from_git(error),
            GitEnvError::Timeout(_) => {
                AppError::new(ErrorCode::GitUnusable, "Git did not respond.").with_hint(
                    "Check that git works in a terminal (`git --version`), then try again.",
                )
            }
        }
    }
}

/// Maps any git runner error to the error shown to the user.
pub fn error_from_git(error: GitError) -> AppError {
    tracing::warn!(%error, "git error");
    match error {
        GitError::NotFound { .. } => AppError::new(
            ErrorCode::GitNotFound,
            "Git is not installed, or NoBlame cannot find it.",
        )
        .with_hint(install_hint()),
        GitError::Failed { stderr, .. } => AppError::new(ErrorCode::GitFailed, stderr),
        GitError::Cancelled { .. } => {
            AppError::new(ErrorCode::Cancelled, "The operation was cancelled.")
        }
        GitError::InvalidArgument { value, reason } => AppError::new(
            ErrorCode::InvalidInput,
            format!("\"{value}\" is not allowed: {reason}."),
        ),
        GitError::Spawn { program, source } => AppError::new(
            ErrorCode::GitUnusable,
            format!(
                "Git at {} could not be started: {source}.",
                program.display()
            ),
        )
        .with_hint(install_hint()),
        GitError::UnparseableVersion(output) => AppError::new(
            ErrorCode::GitUnusable,
            format!("The program found as git does not look like git (it printed \"{output}\")."),
        )
        .with_hint(install_hint()),
        GitError::Io(source) => AppError::new(
            ErrorCode::GitUnusable,
            format!("Communication with git failed: {source}."),
        ),
    }
}

fn install_hint() -> String {
    let install = if cfg!(windows) {
        "Install Git for Windows from https://git-scm.com/download/win"
    } else if cfg!(target_os = "macos") {
        "Install git with `xcode-select --install` or Homebrew (`brew install git`)"
    } else {
        "Install git with your package manager, for example `sudo apt install git`"
    };
    format!("{install}, or set {GIT_OVERRIDE_ENV} to the full path of a git executable.")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn not_found_explains_how_to_install() {
        let error = AppError::from(GitEnvError::Git(GitError::NotFound { searched: vec![] }));
        assert_eq!(error.code, ErrorCode::GitNotFound);
        assert!(error.hint.unwrap().contains(GIT_OVERRIDE_ENV));
    }

    #[test]
    fn failed_commands_carry_git_stderr() {
        let error = error_from_git(GitError::Failed {
            command: "git status".into(),
            code: Some(128),
            stderr: "fatal: not a git repository".into(),
        });
        assert_eq!(error.code, ErrorCode::GitFailed);
        assert_eq!(error.message, "fatal: not a git repository");
    }
}
