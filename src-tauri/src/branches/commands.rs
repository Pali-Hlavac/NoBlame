//! Tauri boundary for checking out, and for creating, renaming and deleting branches and tags
//! (the list is `list_refs`).

use tauri::State;

use super::service;
use super::types::{
    CreateBranchRequestDto, CreateTagRequestDto, RefTargetDto, RenameBranchRequestDto,
    UniqueCommitsDto,
};
use crate::error::CommandResult;
use crate::repository::{RepoId, RepoSessions};

/// Checks out the local branch `name`; returns what git printed. git refuses when local
/// changes would be overwritten.
#[tauri::command]
#[specta::specta]
pub async fn checkout_branch(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    name: String,
) -> CommandResult<String> {
    Ok(service::checkout_branch(&sessions, id, name).await?)
}

/// Checks out a commit without a branch (detached HEAD).
#[tauri::command]
#[specta::specta]
pub async fn checkout_commit(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    commit: String,
) -> CommandResult<String> {
    Ok(service::checkout_commit(&sessions, id, commit).await?)
}

/// Creates a branch, and checks it out when asked.
#[tauri::command]
#[specta::specta]
pub async fn create_branch(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: CreateBranchRequestDto,
) -> CommandResult<String> {
    Ok(service::create(&sessions, id, request).await?)
}

/// Renames a branch, checked first to still point where the user saw it.
#[tauri::command]
#[specta::specta]
pub async fn rename_branch(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: RenameBranchRequestDto,
) -> CommandResult<String> {
    Ok(service::rename(&sessions, id, request).await?)
}

/// The commits only this branch or tag holds, for the confirmation before deleting it.
#[tauri::command]
#[specta::specta]
pub async fn get_unique_commits(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    reference: RefTargetDto,
) -> CommandResult<UniqueCommitsDto> {
    Ok(service::unique(&sessions, id, reference).await?)
}

/// Deletes a local branch (merged or not) or a tag, checked first to still point where the
/// user saw it.
#[tauri::command]
#[specta::specta]
pub async fn delete_ref(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    reference: RefTargetDto,
) -> CommandResult<String> {
    Ok(service::delete(&sessions, id, reference).await?)
}

/// Creates a tag: annotated with a message, lightweight without.
#[tauri::command]
#[specta::specta]
pub async fn create_tag(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: CreateTagRequestDto,
) -> CommandResult<String> {
    Ok(service::tag(&sessions, id, request).await?)
}
