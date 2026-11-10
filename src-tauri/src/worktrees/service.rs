//! Worktrees behind the Tauri commands. Changes hold the session's write lock; git runs in the
//! session's work tree (or the repository, when bare), which any worktree's commands accept.

use std::path::{Path, PathBuf};

use git_core::cli::Git;
use git_core::repo::{RepoKind, Repository};
use git_core::worktree::{
    AddWorktree, add_worktree, list_worktrees, lock_worktree, prune_worktrees, remove_worktree,
    unlock_worktree,
};
use tokio_util::sync::CancellationToken;

use super::types::{AddWorktreeRequestDto, WorktreeDto};
use crate::error::{AppError, ErrorCode};
use crate::git_env::GitEnvError;
use crate::repository::{RepoId, RepoSessions, RepositoryError};

/// Where git runs: the work tree, or the repository itself when it is bare.
fn run_dir(repo: &Repository) -> PathBuf {
    let info = repo.info();
    match (&info.work_dir, info.kind) {
        (Some(work_dir), kind) if kind != RepoKind::Bare => work_dir.clone(),
        _ => info.git_dir.clone(),
    }
}

fn git() -> Result<Git, RepositoryError> {
    Ok(Git::locate().map_err(GitEnvError::from)?)
}

/// Whether `a` and `b` name the same folder (resolved, so `/` and `\` or a symlink match).
fn same_folder(a: &Path, b: &Path) -> bool {
    match (a.canonicalize(), b.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => a == b,
    }
}

/// The repository's worktrees, the main one first; `current` marks this tab's.
pub async fn list(
    sessions: &RepoSessions,
    id: RepoId,
) -> Result<Vec<WorktreeDto>, RepositoryError> {
    let session = sessions.get(id)?;
    let dir = run_dir(&session.repo);
    let here = session.repo.info().work_dir.clone();
    let listed = list_worktrees(&git()?, &dir, &CancellationToken::new()).await?;
    Ok(listed
        .into_iter()
        .map(|worktree| {
            let current = here
                .as_deref()
                .is_some_and(|here| same_folder(here, &worktree.path));
            WorktreeDto::new(worktree, current)
        })
        .collect())
}

/// Adds a worktree; returns what git printed.
pub async fn add(
    sessions: &RepoSessions,
    id: RepoId,
    request: AddWorktreeRequestDto,
) -> Result<String, RepositoryError> {
    let session = sessions.get(id)?;
    let dir = run_dir(&session.repo);
    let request = AddWorktree {
        folder: PathBuf::from(request.folder),
        checkout: request.checkout.into(),
    };
    let git = git()?;
    let _writing = session.lock_writes().await;
    Ok(add_worktree(&git, &dir, &request, &CancellationToken::new()).await?)
}

/// Removes the worktree at `folder` (with `force`: also when it has changes, which are lost).
/// This tab's own worktree is refused: close it, then remove it from another.
pub async fn remove(
    sessions: &RepoSessions,
    id: RepoId,
    folder: String,
    force: bool,
) -> Result<String, AppError> {
    let session = sessions.get(id)?;
    let folder = PathBuf::from(folder);
    if let Some(here) = session.repo.info().work_dir.as_deref()
        && same_folder(here, &folder)
    {
        return Err(AppError::new(
            ErrorCode::InvalidInput,
            "This is the worktree of the open tab.",
        )
        .with_hint("Remove it from the tab of another worktree of this repository."));
    }
    let dir = run_dir(&session.repo);
    let git = git()?;
    let _writing = session.lock_writes().await;
    Ok(
        remove_worktree(&git, &dir, &folder, force, &CancellationToken::new())
            .await
            .map_err(RepositoryError::from)?,
    )
}

/// Locks the worktree at `folder`, with an optional reason.
pub async fn lock(
    sessions: &RepoSessions,
    id: RepoId,
    folder: String,
    reason: String,
) -> Result<String, RepositoryError> {
    let session = sessions.get(id)?;
    let dir = run_dir(&session.repo);
    let git = git()?;
    let _writing = session.lock_writes().await;
    let folder = PathBuf::from(folder);
    Ok(lock_worktree(&git, &dir, &folder, &reason, &CancellationToken::new()).await?)
}

/// Unlocks the worktree at `folder`.
pub async fn unlock(
    sessions: &RepoSessions,
    id: RepoId,
    folder: String,
) -> Result<String, RepositoryError> {
    let session = sessions.get(id)?;
    let dir = run_dir(&session.repo);
    let git = git()?;
    let _writing = session.lock_writes().await;
    let folder = PathBuf::from(folder);
    Ok(unlock_worktree(&git, &dir, &folder, &CancellationToken::new()).await?)
}

/// Forgets the worktrees whose folders are gone; returns what git printed.
pub async fn prune(sessions: &RepoSessions, id: RepoId) -> Result<String, RepositoryError> {
    let session = sessions.get(id)?;
    let dir = run_dir(&session.repo);
    let git = git()?;
    let _writing = session.lock_writes().await;
    Ok(prune_worktrees(&git, &dir, &CancellationToken::new()).await?)
}
