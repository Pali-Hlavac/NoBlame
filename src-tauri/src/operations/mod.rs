//! Changing history: merging into the current branch, cherry-picking, reverting, resetting and
//! rebasing,
//! and the operation in progress (merge, cherry-pick, revert, rebase, `git am`, bisect) with
//! Continue, Skip and Abort. See
//! `docs/features/operations.md`.

pub mod commands;
mod conflicts;
mod error;
mod pick;
mod rebase;
mod service;
mod types;

pub use service::current_operation;
pub use types::OperationDto;
