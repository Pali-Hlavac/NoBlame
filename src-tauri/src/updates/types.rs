//! What the frontend learns about updates.

use serde::{Deserialize, Serialize};
use specta::Type;

/// Whether this build can update itself, and its version.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSupport {
    /// A release build with an update key and a feed; `false` for builds from source.
    pub configured: bool,
    /// The running version.
    pub current_version: String,
}

/// A newer release the feed offers.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AvailableUpdate {
    /// Its version (`0.2.0`).
    pub version: String,
    /// The running version.
    pub current_version: String,
    /// Its release notes, as the feed has them (Markdown).
    pub notes: Option<String>,
}

/// How far the download of an update got. Sent while it downloads.
#[derive(Debug, Clone, Serialize, Deserialize, Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgress {
    /// Bytes downloaded so far.
    pub downloaded: f64,
    /// The update's size, when the server says.
    pub total: Option<f64>,
}
