//! Tauri boundary for the read-only repository views.

use tauri::State;

use super::{
    ChangedFilesDto, CommitDetailsDto, DiffLineDto, FileDiffDto, RefEntry, StashDto,
    StatusSummaryDto, SubmoduleDto, service,
};
use crate::error::CommandResult;
use crate::repository::{RepoId, RepoSessions};

/// Details of the commit on `row`: message, people, parents, refs and refs containing it.
#[tauri::command]
#[specta::specta]
pub async fn get_commit_details(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    row: u32,
) -> CommandResult<CommitDetailsDto> {
    Ok(service::details(&sessions, id, row).await?)
}

/// The files the commit on `row` changed against its parent number `parent` (0 = first).
#[tauri::command]
#[specta::specta]
pub async fn get_changed_files(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    row: u32,
    parent: u32,
) -> CommandResult<ChangedFilesDto> {
    Ok(service::changed_files(&sessions, id, row, parent).await?)
}

/// The line diff between two blobs (hex ids; `null` where the file is absent): its kind,
/// size and row count. Rows come from `get_diff_lines`.
#[tauri::command]
#[specta::specta]
pub async fn get_file_diff(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    old_id: Option<String>,
    new_id: Option<String>,
) -> CommandResult<FileDiffDto> {
    Ok(service::file_diff(&sessions, id, old_id, new_id).await?)
}

/// Up to `count` rows (at most 2,000) of that diff, from row `start`.
#[tauri::command]
#[specta::specta]
pub async fn get_diff_lines(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    old_id: Option<String>,
    new_id: Option<String>,
    start: u32,
    count: u32,
) -> CommandResult<Vec<DiffLineDto>> {
    Ok(service::diff_lines(&sessions, id, old_id, new_id, start, count).await?)
}

/// Every branch, remote branch and tag with the row of its commit.
#[tauri::command]
#[specta::specta]
pub async fn list_refs(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<Vec<RefEntry>> {
    Ok(service::refs(&sessions, id).await?)
}

/// The working tree status summary (`null` for a bare repository).
#[tauri::command]
#[specta::specta]
pub async fn get_status_summary(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<Option<StatusSummaryDto>> {
    Ok(service::status(&sessions, id).await?)
}

/// The stash list, newest first.
#[tauri::command]
#[specta::specta]
pub async fn list_stashes(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<Vec<StashDto>> {
    Ok(service::stashes(&sessions, id).await?)
}

/// Submodules of the repository containing `path`, nested recursively.
#[tauri::command]
#[specta::specta]
pub async fn list_submodules(path: String) -> CommandResult<Vec<SubmoduleDto>> {
    Ok(service::submodules(path).await?)
}
