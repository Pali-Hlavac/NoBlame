//! Changing history: merging into the current branch, cherry-picking, reverting, resetting and
//! rebasing, resolving conflicts (a side, the merge tool, the built-in merge view),
//! and the operation in progress (merge, cherry-pick, revert, rebase, `git am`, bisect) with
//! Continue, Skip and Abort. See
//! `docs/features/operations.md`.

pub mod commands;
mod conflicts;
mod error;
mod interactive;
mod merge_view;
mod pick;
mod rebase;
mod service;
mod types;

pub use service::current_operation;
pub use types::OperationDto;
