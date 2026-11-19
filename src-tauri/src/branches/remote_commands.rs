//! Tauri boundary for managing the remotes of an open repository (fetching from them is a job:
//! `jobs::commands`).

use tauri::State;

use super::remote_password;
use super::remote_settings;
use super::remote_settings_types::{RemoteEditDto, RemoteSettingsDto};
use super::remote_ssh;
use super::remote_types::{AddRemoteRequestDto, RemoteDto};
use super::remotes;
use crate::error::CommandResult;
use crate::repository::{RepoId, RepoSessions};
use crate::ssh_keys::SshKeysStore;

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
    ssh: State<'_, SshKeysStore>,
    id: RepoId,
    name: String,
) -> CommandResult<String> {
    let said = remotes::remove(&sessions, id, name.clone()).await?;
    remote_ssh::follow(&sessions, &ssh, id, &name, None);
    Ok(said)
}

/// The settings of one remote for the remote editor, every scope, secrets hidden.
#[tauri::command]
#[specta::specta]
pub async fn get_remote_settings(
    sessions: State<'_, RepoSessions>,
    ssh: State<'_, SshKeysStore>,
    id: RepoId,
    name: String,
) -> CommandResult<RemoteSettingsDto> {
    remote_settings::settings(&sessions, &ssh, id, name).await
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
    ssh: State<'_, SshKeysStore>,
    id: RepoId,
    edit: RemoteEditDto,
) -> CommandResult<()> {
    remote_settings::apply(&sessions, &ssh, id, edit).await
}

/// Chooses the SSH private key NoBlame uses for `name` (None forgets it); NoBlame's own
/// setting, passed as `GIT_SSH_COMMAND` when it talks to that remote.
#[tauri::command]
#[specta::specta]
pub async fn set_remote_ssh_key(
    sessions: State<'_, RepoSessions>,
    ssh: State<'_, SshKeysStore>,
    id: RepoId,
    name: String,
    key: Option<String>,
) -> CommandResult<()> {
    remote_ssh::choose(&sessions, &ssh, id, &name, key)
}

/// Moves the passwords written into `name`'s URLs to the credential helper; how many moved.
#[tauri::command]
#[specta::specta]
pub async fn move_remote_passwords(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    name: String,
) -> CommandResult<u32> {
    remote_password::move_passwords(&sessions, id, name).await
}
