//! Adding, removing, locking, unlocking and pruning worktrees with the `git` CLI. Folders go
//! after `--`, so none is read as an option.

use std::path::Path;
use std::{fs, io};

use tokio_util::sync::CancellationToken;

use crate::branch::{BranchError, RefNamespace, accepted, validate_name};
use crate::cli::Git;

/// What a new worktree checks out.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WorktreeCheckout {
    /// A new branch `name` made at `start` (a revision).
    NewBranch {
        /// The branch's name.
        name: String,
        /// Where it starts.
        start: String,
    },
    /// An existing local branch (git refuses one checked out in another worktree).
    Branch(String),
    /// A commit, without a branch (`--detach`).
    Detached(String),
}

/// A worktree to add.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AddWorktree {
    /// Its folder: a full path that does not exist yet, or an empty folder.
    pub folder: std::path::PathBuf,
    /// What it checks out.
    pub checkout: WorktreeCheckout,
}

fn invalid(folder: &Path, reason: &str) -> BranchError {
    BranchError::Rejected {
        output: format!("{} {reason}", folder.display()),
    }
}

/// Checks that `folder` can take a new worktree: a full path that does not exist, or an empty
/// folder (what git accepts).
pub fn check_worktree_folder(folder: &Path) -> Result<(), BranchError> {
    if !folder.is_absolute() {
        return Err(invalid(folder, "is not a full path."));
    }
    match fs::metadata(folder) {
        Ok(metadata) if !metadata.is_dir() => Err(invalid(folder, "is a file.")),
        Ok(_) => match fs::read_dir(folder).map(|mut entries| entries.next().is_none()) {
            Ok(true) => Ok(()),
            Ok(false) => Err(invalid(
                folder,
                "is not empty. Choose a new folder, or an empty one.",
            )),
            Err(error) => Err(invalid(folder, &format!("cannot be read: {error}."))),
        },
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(invalid(folder, &format!("cannot be read: {error}."))),
    }
}

/// `git worktree add` in the repository at `dir`; returns what git printed.
pub async fn add_worktree(
    git: &Git,
    dir: &Path,
    request: &AddWorktree,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    check_worktree_folder(&request.folder)?;
    let mut command = git.command().current_dir(dir).args(["worktree", "add"]);
    let folder = request.folder.as_os_str();
    command = match &request.checkout {
        WorktreeCheckout::NewBranch { name, start } => {
            validate_name(RefNamespace::Branch, name)?;
            command
                .arg("-b")
                .revision(name)?
                .operands([folder, start.as_ref()])
        }
        WorktreeCheckout::Branch(name) => {
            validate_name(RefNamespace::Branch, name)?;
            command.operands([folder, name.as_ref()])
        }
        WorktreeCheckout::Detached(revision) => command
            .arg("--detach")
            .operands([folder, revision.as_ref()]),
    };
    accepted(&command.output(cancel).await?)
}

/// `git worktree remove [--force] -- <folder>`. Without `force` git refuses when the worktree
/// has changed or untracked files; a locked one is always refused.
pub async fn remove_worktree(
    git: &Git,
    dir: &Path,
    folder: &Path,
    force: bool,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    let mut command = git.command().current_dir(dir).args(["worktree", "remove"]);
    if force {
        command = command.arg("--force");
    }
    accepted(&command.operands([folder]).output(cancel).await?)
}

/// `git worktree lock [--reason=<reason>] -- <folder>`.
pub async fn lock_worktree(
    git: &Git,
    dir: &Path,
    folder: &Path,
    reason: &str,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    let mut command = git.command().current_dir(dir).args(["worktree", "lock"]);
    if !reason.trim().is_empty() {
        command = command.option("--reason", reason.trim());
    }
    accepted(&command.operands([folder]).output(cancel).await?)
}

/// `git worktree unlock -- <folder>`.
pub async fn unlock_worktree(
    git: &Git,
    dir: &Path,
    folder: &Path,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    let command = git.command().current_dir(dir).args(["worktree", "unlock"]);
    accepted(&command.operands([folder]).output(cancel).await?)
}

/// `git worktree prune --verbose`: forgets worktrees whose folders are gone (not locked ones).
/// Returns what git printed (a line per worktree removed).
pub async fn prune_worktrees(
    git: &Git,
    dir: &Path,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    let command = git
        .command()
        .current_dir(dir)
        .args(["worktree", "prune", "--verbose"]);
    accepted(&command.output(cancel).await?)
}
