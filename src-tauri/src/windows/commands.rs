//! Tauri boundary for windows.

use tauri::{AppHandle, State, WebviewWindow};

use std::path::PathBuf;

use super::{WindowContext, WindowError, WindowRegistry, service};
use crate::cli::{LaunchRequest, LaunchTarget, TaskKind};
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
    let paths = registry.take_repository_requests();
    tracing::debug!(?paths, "repository requests taken");
    paths
}

/// Shows the main window (opening it if needed) with `path` as a repository tab, like
/// `noblame <path>`: a task window's **Open in NoBlame**.
#[tauri::command]
#[specta::specta]
pub async fn open_in_main_window(app: AppHandle, path: String) -> CommandResult<()> {
    let request = LaunchRequest {
        target: LaunchTarget::Main,
        path: Some(PathBuf::from(path)),
    };
    service::launch(&app, request)?;
    Ok(())
}

/// Opens `task` for `path` in a window, like `noblame <task> <path>` does (a window already
/// showing it comes to the front).
#[tauri::command]
#[specta::specta]
pub async fn open_task_window(app: AppHandle, task: TaskKind, path: String) -> CommandResult<()> {
    service::open_task_window(&app, task, path)?;
    Ok(())
}
