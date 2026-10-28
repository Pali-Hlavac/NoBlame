//! Tauri boundary for loading and saving the workbench layout.

use tauri::State;

use super::{Layout, LayoutFile, LayoutStore};
use crate::error::CommandResult;

/// The saved layout, or `None` on first launch. A corrupted file is logged and treated as
/// missing, so a bad layout can never stop the main window from opening.
#[tauri::command]
#[specta::specta]
pub async fn get_workbench_layout(store: State<'_, LayoutStore>) -> CommandResult<Option<Layout>> {
    match store.load() {
        Ok(file) => Ok(file.layout),
        Err(error) => {
            tracing::warn!(%error, "ignoring the saved workbench layout");
            Ok(None)
        }
    }
}

/// Saves the layout; `None` forgets it, so the next start uses the default layout.
#[tauri::command]
#[specta::specta]
pub async fn save_workbench_layout(
    store: State<'_, LayoutStore>,
    layout: Option<Layout>,
) -> CommandResult<()> {
    Ok(store.save(&LayoutFile { layout })?)
}
