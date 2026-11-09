//! Opening a working tree file in its default app, and showing it in the file manager
//! (Explorer, Finder, the Linux file manager), for the file lists' context menu.

use std::path::PathBuf;

use git_core::locate::{LocateError, nearest_existing, openable, worktree_item};
use tauri::State;

use super::service::work_dir;
use crate::error::{AppError, CommandResult, ErrorCode};
use crate::repository::{RepoId, RepoSessions, RepositoryError};

/// Why a file could not be opened or shown.
#[derive(Debug, thiserror::Error)]
pub enum OpenError {
    /// The repository is not open, or failed otherwise.
    #[error(transparent)]
    Repository(#[from] RepositoryError),
    /// The path is not a working tree file NoBlame may open.
    #[error(transparent)]
    Locate(#[from] LocateError),
    /// A bare repository has no working tree.
    #[error("a bare repository has no working tree")]
    Bare,
    /// The operating system could not open or show it.
    #[error("{0}")]
    System(String),
}

impl From<OpenError> for AppError {
    fn from(error: OpenError) -> Self {
        match error {
            OpenError::Repository(error) => error.into(),
            OpenError::Locate(LocateError::Outside(path)) => AppError::new(
                ErrorCode::InvalidInput,
                format!("{path} is not a path inside the working tree."),
            ),
            OpenError::Locate(LocateError::Missing(path)) => AppError::new(
                ErrorCode::NotFound,
                format!("{path} is not in the working tree."),
            )
            .with_hint("It is not on disk (deleted, renamed or never checked out). Save this version with Save as… instead."),
            OpenError::Locate(LocateError::Program(path)) => AppError::new(
                ErrorCode::InvalidInput,
                format!("NoBlame does not open {path}: opening it would run it as a program."),
            )
            .with_hint("Show it in the folder instead, and open it from there if you trust it."),
            OpenError::Bare => AppError::new(
                ErrorCode::InvalidInput,
                "This repository has no working tree (it is bare).",
            ),
            OpenError::System(message) => {
                tracing::warn!(%message, "opening a file failed");
                AppError::new(ErrorCode::Io, format!("Could not open it: {message}"))
            }
        }
    }
}

/// The working tree item `path` of repository `id` on disk.
fn locate(
    sessions: &RepoSessions,
    id: RepoId,
    path: &str,
) -> Result<(PathBuf, PathBuf), OpenError> {
    let session = sessions.get(id)?;
    let root = work_dir(&session.repo).ok_or(OpenError::Bare)?;
    let full = worktree_item(&root, path)?;
    Ok((root, full))
}

/// Runs a call to the operating system's shell off the async runtime.
async fn shell(
    call: impl FnOnce() -> Result<(), tauri_plugin_opener::Error> + Send + 'static,
) -> Result<(), OpenError> {
    tauri::async_runtime::spawn_blocking(call)
        .await
        .map_err(|error| OpenError::System(error.to_string()))?
        .map_err(|error| OpenError::System(error.to_string()))
}

/// Opens the working tree file at `path` (relative, `/`-separated) in its default app.
/// Files that would run as programs (by extension or executable bit) are refused.
#[tauri::command]
#[specta::specta]
pub async fn open_worktree_file(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    path: String,
) -> CommandResult<()> {
    let (_, full) = locate(&sessions, id, &path)?;
    openable(&full, &path).map_err(OpenError::from)?;
    Ok(shell(move || tauri_plugin_opener::open_path(full, None::<&str>)).await?)
}

/// Shows the working tree item at `path` selected in the file manager; when it is gone, its
/// nearest folder that is still there.
#[tauri::command]
#[specta::specta]
pub async fn show_worktree_file(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    path: String,
) -> CommandResult<()> {
    let (root, full) = locate(&sessions, id, &path)?;
    let shown = nearest_existing(&root, &full);
    Ok(shell(move || tauri_plugin_opener::reveal_item_in_dir(shown)).await?)
}
