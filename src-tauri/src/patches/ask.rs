//! Asking where to save, with the system's dialogs, from Rust: the webview never names the file
//! the app writes. `None` when the user cancelled.

use std::path::PathBuf;

use tauri::WebviewWindow;
use tauri_plugin_dialog::{DialogExt, FilePath};

use crate::repository::RepositoryError;

/// A kind of file the save dialog offers: its name and extensions (without the dot).
pub struct FileKind {
    pub name: &'static str,
    pub extensions: &'static [&'static str],
}

fn into_path(path: Option<FilePath>) -> Result<Option<PathBuf>, RepositoryError> {
    path.map(|path| {
        path.into_path()
            .map_err(|error| RepositoryError::Task(error.to_string()))
    })
    .transpose()
}

/// Asks for a file to save, proposing `file_name`.
pub async fn save_path(
    window: &WebviewWindow,
    title: &str,
    file_name: &str,
    kind: &FileKind,
) -> Result<Option<PathBuf>, RepositoryError> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    window
        .dialog()
        .file()
        .set_parent(window)
        .set_title(title)
        .set_file_name(file_name)
        .add_filter(kind.name, kind.extensions)
        .save_file(move |path| {
            // The receiver is gone only if the command was dropped; nothing to tell then.
            let _ = sender.send(path);
        });
    into_path(receiver.await.ok().flatten())
}

/// Asks for a folder.
pub async fn folder(
    window: &WebviewWindow,
    title: &str,
) -> Result<Option<PathBuf>, RepositoryError> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    window
        .dialog()
        .file()
        .set_parent(window)
        .set_title(title)
        .pick_folder(move |path| {
            let _ = sender.send(path);
        });
    into_path(receiver.await.ok().flatten())
}
