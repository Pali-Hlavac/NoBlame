//! Tauri boundary for opening a diff in an external tool.

use tauri::State;

use super::difftool::{self, ExternalDiffRequestDto};
use crate::error::CommandResult;
use crate::repository::{RepoId, RepoSessions};
use crate::settings::SettingsStore;

/// Opens a file's two versions in the external diff tool chosen in Settings (through
/// `git difftool --no-index`). Returns once the tool started; fails when it could not.
#[tauri::command]
#[specta::specta]
pub async fn open_external_diff(
    sessions: State<'_, RepoSessions>,
    settings: State<'_, SettingsStore>,
    id: RepoId,
    request: ExternalDiffRequestDto,
) -> CommandResult<()> {
    let tool = settings.load()?.diff.external_tool;
    Ok(difftool::open(&sessions, id, tool, request).await?)
}
