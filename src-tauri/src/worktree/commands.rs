//! Tauri boundary for the working tree.

use tauri::State;

use super::staging::{self, Scope};
use super::types::{CommitRequestDto, CommitResultDto};
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

/// Stages the files at `paths` as they are in the working tree (changes, new files,
/// deletions; a conflicted file is marked resolved).
#[tauri::command]
#[specta::specta]
pub async fn stage_files(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    paths: Vec<String>,
) -> CommandResult<()> {
    Ok(staging::stage(&sessions, id, Scope::Paths(paths)).await?)
}

/// Stages every change in the working tree.
#[tauri::command]
#[specta::specta]
pub async fn stage_all_files(sessions: State<'_, RepoSessions>, id: RepoId) -> CommandResult<()> {
    Ok(staging::stage(&sessions, id, Scope::All).await?)
}

/// Unstages the files at `paths` (both names of a rename); the working tree is not touched.
#[tauri::command]
#[specta::specta]
pub async fn unstage_files(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    paths: Vec<String>,
) -> CommandResult<()> {
    Ok(staging::unstage(&sessions, id, Scope::Paths(paths)).await?)
}

/// Unstages everything; the working tree is not touched.
#[tauri::command]
#[specta::specta]
pub async fn unstage_all_files(sessions: State<'_, RepoSessions>, id: RepoId) -> CommandResult<()> {
    Ok(staging::unstage(&sessions, id, Scope::All).await?)
}

/// Commits the staged changes (or amends the last commit). Hooks run; when git refuses, the
/// error's message is everything git and its hooks printed.
#[tauri::command]
#[specta::specta]
pub async fn create_commit(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: CommitRequestDto,
) -> CommandResult<CommitResultDto> {
    Ok(staging::create_commit(&sessions, id, request).await?)
}

/// The message of the commit HEAD points at (`null` before the first commit), for amending.
#[tauri::command]
#[specta::specta]
pub async fn get_head_message(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<Option<String>> {
    Ok(staging::last_message(&sessions, id).await?)
}
