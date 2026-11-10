//! What the worktree commands take and return.

use git_core::worktree::{Worktree, WorktreeCheckout};
use serde::{Deserialize, Serialize};
use specta::Type;

/// One worktree of the repository.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeDto {
    /// Its folder, with the platform's separators.
    pub path: String,
    /// The commit checked out (hex); `null` when bare or the branch has no commit yet.
    pub head: Option<String>,
    /// The branch checked out (short name); `null` when detached (HEAD at a commit) or bare.
    pub branch: Option<String>,
    /// A bare repository (no files checked out).
    pub bare: bool,
    /// The main worktree: it cannot be removed.
    pub main: bool,
    /// The worktree of this tab's repository.
    pub current: bool,
    /// Locked: the reason, or an empty text; `null` when not locked.
    pub locked: Option<String>,
    /// Its folder is gone (prune would forget it): why; `null` otherwise.
    pub prunable: Option<String>,
}

impl WorktreeDto {
    pub fn new(worktree: Worktree, current: bool) -> Self {
        Self {
            path: worktree.path.to_string_lossy().into_owned(),
            head: worktree.head,
            branch: worktree.branch,
            bare: worktree.bare,
            main: worktree.main,
            current,
            locked: worktree.locked,
            prunable: worktree.prunable,
        }
    }
}

/// What a new worktree checks out.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum WorktreeCheckoutDto {
    /// A new branch `name` made at `start`.
    NewBranch { name: String, start: String },
    /// An existing local branch.
    Branch { name: String },
    /// A commit without a branch.
    Detached { revision: String },
}

impl From<WorktreeCheckoutDto> for WorktreeCheckout {
    fn from(checkout: WorktreeCheckoutDto) -> Self {
        match checkout {
            WorktreeCheckoutDto::NewBranch { name, start } => Self::NewBranch { name, start },
            WorktreeCheckoutDto::Branch { name } => Self::Branch(name),
            WorktreeCheckoutDto::Detached { revision } => Self::Detached(revision),
        }
    }
}

/// A worktree to add.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AddWorktreeRequestDto {
    /// Its folder: a full path that does not exist yet, or an empty folder.
    pub folder: String,
    /// What it checks out.
    pub checkout: WorktreeCheckoutDto,
}
