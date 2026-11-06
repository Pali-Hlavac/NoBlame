//! Checking out, creating, renaming and deleting branches with `git switch` and `git branch`.

use std::path::Path;

use tokio_util::sync::CancellationToken;

use super::{BranchError, RefNamespace, accepted, validate_name};
use crate::cli::Git;

/// A branch to create.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateBranch {
    /// Its name (`feature/x`), checked with [`validate_name`].
    pub name: String,
    /// Where it starts: a commit id, a branch, a remote branch or a tag.
    pub start: String,
    /// Check it out afterwards (`git switch --create`), else only create it (`git branch`).
    pub checkout: bool,
    /// Make `start` (a remote branch) its upstream whatever `branch.autoSetupMerge` says.
    pub track: bool,
}

/// Checks out the local branch `name` (`git switch --no-guess`: never creates one from a remote
/// branch of the same name). git refuses when local changes would be overwritten.
pub async fn switch_branch(
    git: &Git,
    work_dir: &Path,
    name: &str,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    let command = git
        .command()
        .current_dir(work_dir)
        .args(["switch", "--no-guess"])
        .revision(name)?;
    accepted(&command.output(cancel).await?)
}

/// Checks out `commit` without a branch (`git switch --detach`).
pub async fn switch_detached(
    git: &Git,
    work_dir: &Path,
    commit: &str,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    let command = git
        .command()
        .current_dir(work_dir)
        .args(["switch", "--detach"])
        .revision(commit)?;
    accepted(&command.output(cancel).await?)
}

/// Creates a branch, and checks it out when asked. `dir` is the work tree (the repository
/// itself when bare; checking out needs a work tree).
pub async fn create_branch(
    git: &Git,
    dir: &Path,
    branch: &CreateBranch,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    validate_name(RefNamespace::Branch, &branch.name)?;
    let mut command = git.command().current_dir(dir);
    command = if branch.checkout {
        command.arg("switch")
    } else {
        command.arg("branch")
    };
    if branch.track {
        command = command.arg("--track");
    }
    command = if branch.checkout {
        command.option("--create", &branch.name)
    } else {
        command.revision(&branch.name)?
    };
    let command = command.revision(&branch.start)?;
    accepted(&command.output(cancel).await?)
}

/// Renames the branch `name` to `new_name` (`git branch --move`), its reflog and config too.
/// Check it first with [`check_ref`](super::check_ref).
pub async fn rename_branch(
    git: &Git,
    dir: &Path,
    name: &str,
    new_name: &str,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    validate_name(RefNamespace::Branch, new_name)?;
    let command = git
        .command()
        .current_dir(dir)
        .args(["branch", "--move"])
        .revision(name)?
        .revision(new_name)?;
    accepted(&command.output(cancel).await?)
}

/// Deletes the branch `name` even when it is not merged (`git branch --delete --force`); the
/// caller has asked first, naming the commits only it holds. Check it first with
/// [`check_ref`](super::check_ref). git refuses to delete the checked-out branch.
pub async fn delete_branch(
    git: &Git,
    dir: &Path,
    name: &str,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    let command = git
        .command()
        .current_dir(dir)
        .args(["branch", "--delete", "--force"])
        .revision(name)?;
    accepted(&command.output(cancel).await?)
}
