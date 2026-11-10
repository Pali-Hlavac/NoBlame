//! Worktrees: the main one and the linked ones sharing its repository. Listed with
//! `git worktree list --porcelain -z` (`list.rs`); added, removed, locked, unlocked and pruned
//! with the `git` CLI (`manage.rs`). Failures are [`BranchError`](crate::branch::BranchError)s:
//! git refusing, or a name that cannot be a branch.

mod list;
mod manage;

pub use list::{Worktree, list_worktrees, parse_worktrees};
pub use manage::{
    AddWorktree, WorktreeCheckout, add_worktree, check_worktree_folder, lock_worktree,
    prune_worktrees, remove_worktree, unlock_worktree,
};
