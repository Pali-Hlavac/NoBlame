//! Tauri boundary for managing the remotes of an open repository (fetching from them is a job:
//! `jobs::commands`).

use tauri::State;

use super::remote_types::{AddRemoteRequestDto, EditRemoteRequestDto, RemoteDto};
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

/// Changes a remote's URL, push URL and name (only what differs).
#[tauri::command]
#[specta::specta]
pub async fn edit_remote(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: EditRemoteRequestDto,
) -> CommandResult<String> {
    Ok(remotes::edit(&sessions, id, request).await?)
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
