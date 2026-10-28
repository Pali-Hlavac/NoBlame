//! Tauri boundary for the read-only repository views.

use tauri::State;

use super::{CommitDetailsDto, RefEntry, StashDto, SubmoduleDto, service};
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

/// Every branch, remote branch and tag with the row of its commit.
#[tauri::command]
#[specta::specta]
pub async fn list_refs(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<Vec<RefEntry>> {
    Ok(service::refs(&sessions, id).await?)
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
