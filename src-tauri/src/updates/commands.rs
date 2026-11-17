//! Tauri boundary for updating NoBlame.

use tauri::{AppHandle, State};

use super::service::{self, PendingUpdate};
use super::{AvailableUpdate, UpdateSupport, configured};
use crate::error::CommandResult;

/// Whether this build updates itself, and its version.
#[tauri::command]
#[specta::specta]
pub fn get_update_support(app: AppHandle) -> UpdateSupport {
    UpdateSupport {
        configured: configured(),
        current_version: app.package_info().version.to_string(),
    }
}

/// Asks the release feed for a newer version; `null` when this one is the newest.
#[tauri::command]
#[specta::specta]
pub async fn check_for_update(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
) -> CommandResult<Option<AvailableUpdate>> {
    Ok(service::check(&app, &pending).await?)
}

/// Downloads and installs the update the last check found, then restarts NoBlame
/// (`UpdateProgress` events while it downloads).
#[tauri::command]
#[specta::specta]
pub async fn install_update(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
) -> CommandResult<()> {
    Ok(service::install(&app, &pending).await?)
}
