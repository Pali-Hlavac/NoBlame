//! Errors raised while opening a repository.

use std::path::{Path, PathBuf};

/// Why a repository could not be opened or read.
#[derive(Debug, thiserror::Error)]
pub enum RepoError {
    /// Neither the path nor any parent folder is a Git repository.
    #[error("{} is not inside a Git repository", path.display())]
    NotARepository {
        /// The path that was searched from.
        path: PathBuf,
    },
    /// The repository belongs to another user and is not listed in `safe.directory`.
    #[error("the repository at {} is not trusted (owned by another user)", path.display())]
    Untrusted {
        /// The path that was searched from.
        path: PathBuf,
    },
    /// Any other failure reported by `gix` (corrupt files, unsupported format, I/O, ...).
    #[error("{0}")]
    Gix(String),
}

impl RepoError {
    /// Classifies a `gix` discovery failure.
    pub(super) fn from_discover(path: &Path, error: &gix::Error) -> Self {
        let path = path.to_path_buf();
        if error.classify().is_not_found() {
            Self::NotARepository { path }
        } else if error.classify().is_permission_denied() {
            Self::Untrusted { path }
        } else {
            Self::Gix(error.to_string())
        }
    }

    /// Wraps any other `gix` error.
    pub fn gix(error: impl std::fmt::Display) -> Self {
        Self::Gix(error.to_string())
    }
}
