//! Window data shared with the frontend.

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::cli::TaskKind;

/// What a window is for. Each window asks for its own context when it starts.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum WindowContext {
    /// The main window with repository tabs.
    Main,
    /// A focused task window.
    Task {
        /// Which task the window shows.
        task: TaskKind,
        /// Repository, folder or file the task is about.
        path: String,
    },
}

/// Emitted to the main window when repositories were requested (for example by a second
/// `noblame <path>` launch). The main window then calls `take_repository_requests`.
#[derive(Debug, Clone, Serialize, Deserialize, Type, tauri_specta::Event)]
pub struct RepositoriesRequested;
