//! Submodules: listing them with their state (`list.rs`, gix), initializing and updating them
//! (`update.rs`, the `git` CLI as a job), and the commits between two of a submodule's pointers
//! (`log.rs`).

mod list;
mod log;
mod update;

pub use list::{MAX_SUBMODULE_DEPTH, SubmoduleEntry, list_submodules};
pub use log::{
    MAX_POINTER_COMMITS, PointerChange, PointerCommit, PointerLog, pointer_log, submodule_dir,
};
pub use update::{follow_command, submodule_hint, update_command, updated_count};

use crate::cli::GitError;

/// Failures while reading submodules.
#[derive(Debug, thiserror::Error)]
pub enum SubmoduleError {
    /// gix could not read the configuration or a submodule.
    #[error("{0}")]
    Gix(String),
    /// The path cannot be a submodule of this repository (absolute, or leaving it with `..`).
    #[error("{0} is not a path inside the repository")]
    InvalidPath(String),
    /// git could not run.
    #[error(transparent)]
    Git(#[from] GitError),
}

impl SubmoduleError {
    fn gix(error: impl std::fmt::Display) -> Self {
        Self::Gix(error.to_string())
    }
}
