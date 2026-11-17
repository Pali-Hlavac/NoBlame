//! Tauri boundary for reading and updating user settings.

use tauri::{AppHandle, State};

use super::{Settings, SettingsStore};
use crate::error::CommandResult;
use crate::windows;

/// Returns the persisted settings, or defaults on first launch.
#[tauri::command]
#[specta::specta]
pub async fn get_settings(store: State<'_, SettingsStore>) -> CommandResult<Settings> {
    Ok(store.load()?)
}

/// Replaces the persisted settings and returns what was saved.
#[tauri::command]
#[specta::specta]
pub async fn update_settings(
    app: AppHandle,
    store: State<'_, SettingsStore>,
    settings: Settings,
) -> CommandResult<Settings> {
    let icon_before = store.load().ok().map(|saved| saved.app_icon);
    store.save(&settings)?;
    if icon_before != Some(settings.app_icon) {
        windows::apply_app_icon(&app, settings.app_icon);
    }
    Ok(settings)
}
