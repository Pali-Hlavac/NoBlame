//! Tauri boundary for making, applying and dropping stashes (the list is `list_stashes`).

use tauri::State;

use super::stash;
use super::stash_types::{
    ApplyOutcomeDto, ApplyStashFilesRequestDto, ApplyStashRequestDto, StashFilesDto,
    StashRequestDto, StashTargetDto,
};
use crate::error::CommandResult;
use crate::repository::{RepoId, RepoSessions};

/// Stashes the working tree's changes, or only some files; returns what git printed. Fails
/// when there is nothing to stash.
#[tauri::command]
#[specta::specta]
pub async fn stash_changes(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: StashRequestDto,
) -> CommandResult<String> {
    Ok(stash::push(&sessions, id, request).await?)
}

/// Applies a stash, or pops it (dropped unless it conflicted). Conflicts are not an error: the
/// result says so.
#[tauri::command]
#[specta::specta]
pub async fn apply_stash(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: ApplyStashRequestDto,
) -> CommandResult<ApplyOutcomeDto> {
    Ok(stash::apply(&sessions, id, request).await?)
}

/// Drops a stash. Cannot be undone from the app.
#[tauri::command]
#[specta::specta]
pub async fn drop_stash(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    stash: StashTargetDto,
) -> CommandResult<String> {
    Ok(stash::drop(&sessions, id, stash).await?)
}

/// The tracked files a stash changed and the untracked files it saved.
#[tauri::command]
#[specta::specta]
pub async fn get_stash_files(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    stash_id: String,
) -> CommandResult<StashFilesDto> {
    Ok(stash::files(&sessions, id, stash_id).await?)
}

/// Applies some files of a stash (merged as `git stash apply` would); the stash is kept.
#[tauri::command]
#[specta::specta]
pub async fn apply_stash_files(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: ApplyStashFilesRequestDto,
) -> CommandResult<ApplyOutcomeDto> {
    Ok(stash::apply_files(&sessions, id, request).await?)
}
