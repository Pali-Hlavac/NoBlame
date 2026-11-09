//! Operations that change history and can stop half-way: merging (`merge.rs`), and the state of
//! an operation in progress with how to go on, skip or abort it (`state.rs`, `sequence.rs`).
//! All writes run the user's `git`, so hooks, `merge.*` config and rerere apply; reading the
//! state uses gix (the files git leaves in `.git`, as `git status` reads them).

mod merge;
mod sequence;
mod state;

use crate::cli::GitError;

pub use merge::{MergeMode, MergeOutcome, MergeResult, merge, merge_name};
pub use sequence::{SequenceStep, run_step};
pub use state::{Operation, OperationKind, operation_in_progress};

/// Failures of history-changing operations.
#[derive(Debug, thiserror::Error)]
pub enum OperationError {
    /// git could not run, or the revision cannot be passed to it.
    #[error(transparent)]
    Git(#[from] GitError),
    /// git refused (local changes in the way, nothing to continue, ...); `output` is what it said.
    #[error("{output}")]
    Rejected {
        /// Standard output and standard error, trimmed.
        output: String,
    },
    /// The step does not apply to this operation (skipping a merge).
    #[error("{0}")]
    NotApplicable(String),
}
