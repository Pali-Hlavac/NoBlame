//! Tauri boundary for the working tree.

use tauri::State;

use super::{WorkingTreeStatusDto, service};
use crate::error::CommandResult;
use crate::repository::{RawBytes, RepoId, RepoSessions};

/// The working tree status: counts, staged files and unstaged ones (`null` for a bare
/// repository).
#[tauri::command]
#[specta::specta]
pub async fn get_status(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<Option<WorkingTreeStatusDto>> {
    Ok(service::status(&sessions, id).await?)
}

/// The blob id the working tree file at `path` would have (`git hash-object`); `null` when
/// nothing or a folder is there. Diffs and previews of the file name it by this id.
#[tauri::command]
#[specta::specta]
pub async fn get_worktree_file_id(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    path: String,
) -> CommandResult<Option<String>> {
    Ok(service::file_id(&sessions, id, path).await?)
}

/// The contents of the working tree file at `path` (at most 32 MB), for previews such as
/// images, if it is still the version `blob_id` names.
#[tauri::command]
#[specta::specta]
pub async fn get_worktree_file_contents(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    path: String,
    blob_id: String,
) -> CommandResult<RawBytes> {
    Ok(service::file_contents(&sessions, id, path, blob_id).await?)
}
