//! User preferences persisted as JSON in the platform app-config directory.

pub mod commands;
mod commit;
mod diff;
mod graph;
mod submodules;
mod types;

pub use diff::{
    DiffLayout, ExternalDiffTool, ExternalDiffToolKind, ExternalMergeTool, MergeToolKind,
    WhitespaceMode,
};
pub use types::{Settings, ThemePreference};

use tauri::{App, Manager};

use crate::storage::JsonFile;

/// File name of the settings document inside the app-config directory.
const SETTINGS_FILE_NAME: &str = "settings.json";

/// Managed state holding the settings document.
pub type SettingsStore = JsonFile<Settings>;

/// Registers a [`SettingsStore`] pointing at the platform config directory.
pub fn init(app: &App) -> tauri::Result<()> {
    let path = app.path().app_config_dir()?.join(SETTINGS_FILE_NAME);
    app.manage(SettingsStore::new(path));
    Ok(())
}
