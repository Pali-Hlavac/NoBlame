//! Window errors and their mapping to [`AppError`].

use std::path::PathBuf;

use crate::error::{AppError, ErrorCode};

/// Failures while opening windows or looking up their context.
#[derive(Debug, thiserror::Error)]
pub enum WindowError {
    /// The path cannot be represented as a string for the UI.
    #[error("path is not valid Unicode: {0:?}")]
    NonUnicodePath(PathBuf),
    /// A task window was requested without a path.
    #[error("a task window needs a path")]
    MissingPath,
    /// A window asked for its context but was not opened by the app.
    #[error("unknown window {0}")]
    UnknownWindow(String),
    /// The window system failed.
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
}

impl From<WindowError> for AppError {
    fn from(error: WindowError) -> Self {
        match error {
            WindowError::NonUnicodePath(path) => AppError::new(
                ErrorCode::InvalidInput,
                format!(
                    "NoBlame cannot open {} yet: the path is not valid Unicode.",
                    path.display()
                ),
            )
            .with_hint("Rename the folder or open a parent folder whose path is valid Unicode."),
            WindowError::MissingPath => AppError::new(
                ErrorCode::InvalidInput,
                "Choose a repository or folder first.",
            ),
            WindowError::UnknownWindow(label) => AppError::new(
                ErrorCode::NotFound,
                format!("Window \"{label}\" is not known."),
            ),
            WindowError::Tauri(error) => error.into(),
        }
    }
}
