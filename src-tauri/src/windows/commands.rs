//! Tauri boundary for windows.

use tauri::{AppHandle, State, WebviewWindow};

use super::{WindowContext, WindowError, WindowRegistry, service};
use crate::cli::TaskKind;
use crate::error::CommandResult;

/// What the calling window is for: the main window or a task window and its target.
#[tauri::command]
#[specta::specta]
pub fn get_window_context(
    window: WebviewWindow,
    registry: State<'_, WindowRegistry>,
) -> CommandResult<WindowContext> {
    let label = window.label();
    registry
        .context(label)
        .ok_or_else(|| WindowError::UnknownWindow(label.to_owned()).into())
}

/// Repositories requested from the command line since the last call (each returned once).
#[tauri::command]
#[specta::specta]
pub fn take_repository_requests(registry: State<'_, WindowRegistry>) -> Vec<String> {
    registry.take_repository_requests()
}

/// Opens `task` for `path` in a new window, like `noblame <task> <path>` does.
#[tauri::command]
#[specta::specta]
pub async fn open_task_window(app: AppHandle, task: TaskKind, path: String) -> CommandResult<()> {
    service::open_task_window(&app, task, path)?;
    Ok(())
}
