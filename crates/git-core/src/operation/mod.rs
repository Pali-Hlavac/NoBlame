//! Operations that change history and can stop half-way: merging (`merge.rs`), cherry-picking
//! and reverting (`pick.rs`), resetting (`reset.rs`), rebasing (`rebase.rs`), the conflicted
//! files and taking a side (`conflict.rs`), the built-in three-way merge of a conflicted file
//! (`threeway.rs`, `merge_file.rs`), the interactive rebase (`interactive.rs`, its todo list
//! `todo.rs`), the external merge tool (`mergetool.rs`), and the
//! state of an operation in progress with how to go on, skip or abort it (`state.rs`,
//! `sequence.rs`).
//! All writes run the user's `git`, so hooks, `merge.*` config and rerere apply; reading the
//! state uses gix (the files git leaves in `.git`, as `git status` reads them).

mod conflict;
mod interactive;
mod merge;
mod merge_file;
mod mergetool;
mod pick;
mod rebase;
mod reset;
mod sequence;
mod state;
mod threeway;
mod todo;

use crate::branch::BranchError;
use crate::cli::GitError;

pub use conflict::{Conflict, ConflictKind, Side, conflicts, take_side};
pub use interactive::{
    InteractiveOutcome, InteractivePlan, MAX_INTERACTIVE_COMMITS, PlannedCommit, interactive_plan,
    rebase_interactive,
};
pub use merge::{MergeMode, MergeOutcome, MergeResult, merge, merge_name};
pub use merge_file::{MAX_MERGE_FILE_BYTES, MergeFile, Unmergeable, merge_file, save_merged};
pub use mergetool::{MergeToolOutcome, configured_merge_tool, run_merge_tool};
pub use pick::{PickKind, PickOptions, PickOutcome, PickResult, pick};
pub use rebase::{
    RebaseOptions, RebaseOutcome, RebasePreview, RebaseResult, rebase, rebase_preview,
};
pub use reset::{ResetMode, reset};
pub use sequence::{SequenceStep, StepResult, run_step};
pub use state::{Operation, OperationKind, operation_in_progress};
pub use threeway::{ChunkSource, MergeChunk, merge_chunks};
pub use todo::{TodoAction, TodoStep, todo_script};

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
    /// Reading the commits involved failed.
    #[error(transparent)]
    Branch(#[from] BranchError),
    /// The step does not apply to this operation (skipping a merge).
    #[error("{0}")]
    NotApplicable(String),
    /// Reading the repository (the index, a file's versions) failed.
    #[error("{0}")]
    Read(String),
}
