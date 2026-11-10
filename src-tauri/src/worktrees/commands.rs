//! Tauri boundary for the Worktrees module.

use tauri::State;

use super::service;
use super::types::{AddWorktreeRequestDto, WorktreeDto};
use crate::error::CommandResult;
use crate::repository::{RepoId, RepoSessions};

/// The repository's worktrees, the main one first (`git worktree list --porcelain -z`).
#[tauri::command]
#[specta::specta]
pub async fn list_worktrees(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<Vec<WorktreeDto>> {
    Ok(service::list(&sessions, id).await?)
}

/// Adds a worktree in a new (or empty) folder, checking out a new branch, an existing one or
/// a commit; returns what git printed.
#[tauri::command]
#[specta::specta]
pub async fn add_worktree(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: AddWorktreeRequestDto,
) -> CommandResult<String> {
    Ok(service::add(&sessions, id, request).await?)
}

/// Removes the worktree at `folder`; `force` also removes one with changed or untracked files
/// (they are lost). Refused for this tab's own worktree and for locked ones.
#[tauri::command]
#[specta::specta]
pub async fn remove_worktree(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    folder: String,
    force: bool,
) -> CommandResult<String> {
    service::remove(&sessions, id, folder, force).await
}

/// Locks the worktree at `folder` (an empty `reason` gives none).
#[tauri::command]
#[specta::specta]
pub async fn lock_worktree(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    folder: String,
    reason: String,
) -> CommandResult<String> {
    Ok(service::lock(&sessions, id, folder, reason).await?)
}

/// Unlocks the worktree at `folder`.
#[tauri::command]
#[specta::specta]
pub async fn unlock_worktree(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    folder: String,
) -> CommandResult<String> {
    Ok(service::unlock(&sessions, id, folder).await?)
}

/// Forgets worktrees whose folders are gone (`git worktree prune`); returns what git printed.
#[tauri::command]
#[specta::specta]
pub async fn prune_worktrees(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<String> {
    Ok(service::prune(&sessions, id).await?)
}
