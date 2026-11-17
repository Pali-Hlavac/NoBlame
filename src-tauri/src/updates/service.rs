//! Checking the feed and installing the update it offers.

use std::sync::{Mutex, PoisonError};

use tauri::{AppHandle, Url};
use tauri_plugin_updater::{Update, UpdaterExt};
use tauri_specta::Event;

use super::{AvailableUpdate, ENDPOINT, UpdateError, UpdateProgress, configured};

/// The update found by the last check, kept until it is installed.
#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<Update>>);

/// The newest release, when it is newer than this one.
pub async fn check(
    app: &AppHandle,
    pending: &PendingUpdate,
) -> Result<Option<AvailableUpdate>, UpdateError> {
    let endpoint = ENDPOINT
        .filter(|_| configured())
        .ok_or(UpdateError::NotConfigured)?;
    let url = Url::parse(endpoint).map_err(|_| UpdateError::NotConfigured)?;
    let update = app
        .updater_builder()
        .endpoints(vec![url])?
        .build()?
        .check()
        .await?;
    let available = update.as_ref().map(|update| AvailableUpdate {
        version: update.version.clone(),
        current_version: update.current_version.clone(),
        notes: update.body.clone(),
    });
    *pending.0.lock().unwrap_or_else(PoisonError::into_inner) = update;
    Ok(available)
}

/// Downloads and installs the checked update (reporting progress), then restarts NoBlame. On
/// Windows the installer closes the app itself.
pub async fn install(app: &AppHandle, pending: &PendingUpdate) -> Result<(), UpdateError> {
    let update = pending
        .0
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .take()
        .ok_or(UpdateError::NothingToInstall)?;
    let mut downloaded: u64 = 0;
    let progress = app.clone();
    update
        .download_and_install(
            move |chunk, total| {
                downloaded += u64::try_from(chunk).unwrap_or(u64::MAX);
                // Byte counts stay far below 2^53, where f64 starts losing whole numbers.
                #[allow(clippy::cast_precision_loss)]
                let event = UpdateProgress {
                    downloaded: downloaded as f64,
                    total: total.map(|total| total as f64),
                };
                if let Err(error) = event.emit(&progress) {
                    tracing::debug!(%error, "could not report the update's progress");
                }
            },
            || tracing::info!("update downloaded"),
        )
        .await?;
    tracing::info!(version = update.version, "update installed, restarting");
    app.restart()
}
