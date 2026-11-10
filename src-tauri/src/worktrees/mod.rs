//! The Worktrees module's backend: listing a repository's worktrees and adding, removing,
//! locking, unlocking and pruning them (`git_core::worktree`). Not to be confused with
//! `crate::worktree`, the status of the working tree.

pub mod commands;
mod service;
mod types;
