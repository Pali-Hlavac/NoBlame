//! Tauri boundary for managing the remotes of an open repository (fetching from them is a job:
//! `jobs::commands`).

use tauri::State;

use super::remote_settings;
use super::remote_settings_types::{RemoteEditDto, RemoteSettingsDto};
use super::remote_types::{AddRemoteRequestDto, RemoteDto};
use super::remotes;
use crate::error::CommandResult;
use crate::repository::{RepoId, RepoSessions};

/// The remotes with their URLs, remote branches and the local branches tracking them.
#[tauri::command]
#[specta::specta]
pub async fn list_remote_details(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<Vec<RemoteDto>> {
    Ok(remotes::list(&sessions, id).await?)
}

/// Adds a remote (`git remote add`); nothing is fetched yet.
#[tauri::command]
#[specta::specta]
pub async fn add_remote(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: AddRemoteRequestDto,
) -> CommandResult<String> {
    Ok(remotes::add(&sessions, id, request).await?)
}

/// Removes a remote with its remote branches; branches tracking it lose their upstream.
#[tauri::command]
#[specta::specta]
pub async fn remove_remote(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    name: String,
) -> CommandResult<String> {
    Ok(remotes::remove(&sessions, id, name).await?)
}

/// The settings of one remote for the remote editor, every scope, secrets hidden.
#[tauri::command]
#[specta::specta]
pub async fn get_remote_settings(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    name: String,
) -> CommandResult<RemoteSettingsDto> {
    remote_settings::settings(&sessions, id, name).await
}

/// The commands saving the editor's changes would run (secrets hidden); empty: no change.
#[tauri::command]
#[specta::specta]
pub async fn preview_remote_changes(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    edit: RemoteEditDto,
) -> CommandResult<Vec<String>> {
    remote_settings::preview(&sessions, id, edit).await
}

/// Saves the editor's changes, all or nothing.
#[tauri::command]
#[specta::specta]
pub async fn apply_remote_changes(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    edit: RemoteEditDto,
) -> CommandResult<()> {
    remote_settings::apply(&sessions, id, edit).await
}
