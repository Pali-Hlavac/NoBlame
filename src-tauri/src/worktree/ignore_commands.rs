//! Tauri boundary for ignoring untracked files (the `.gitignore` helper).

use tauri::State;

use super::ignore::{self, IgnorePreviewDto, IgnoreRequestDto};
use crate::error::CommandResult;
use crate::repository::{RepoId, RepoSessions};

/// The untracked files listed now that a `.gitignore` pattern would hide (at most 200 named).
#[tauri::command]
#[specta::specta]
pub async fn preview_ignore(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    pattern: String,
) -> CommandResult<IgnorePreviewDto> {
    Ok(ignore::preview(&sessions, id, pattern).await?)
}

/// Adds a pattern to the repository's `.gitignore` or `.git/info/exclude`; `false` when that
/// line is already there.
#[tauri::command]
#[specta::specta]
pub async fn ignore_files(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: IgnoreRequestDto,
) -> CommandResult<bool> {
    Ok(ignore::add(&sessions, id, request).await?)
}
