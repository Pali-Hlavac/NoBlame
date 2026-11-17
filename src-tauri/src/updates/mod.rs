//! Updating NoBlame in place (ADR 0017): checks the release feed, downloads a signed update,
//! installs it and restarts. Only builds made with an update key can update; the release
//! workflow sets it (`NOBLAME_UPDATER_PUBKEY`, `NOBLAME_UPDATER_ENDPOINT` at build time). A build
//! from source has none and says so.

pub mod commands;
mod error;
mod service;
mod types;

pub use error::UpdateError;
pub use service::PendingUpdate;
pub use types::{AvailableUpdate, UpdateProgress, UpdateSupport};

/// The public key update signatures are checked with (minisign, base64), built in by the
/// release workflow.
const PUBKEY: Option<&str> = option_env!("NOBLAME_UPDATER_PUBKEY");
/// Where the release feed (`latest.json`) is, built in by the release workflow.
const ENDPOINT: Option<&str> = option_env!("NOBLAME_UPDATER_ENDPOINT");

/// Whether this build can update itself (it has a key and a feed).
pub fn configured() -> bool {
    PUBKEY.is_some_and(|key| !key.is_empty()) && ENDPOINT.is_some_and(|url| !url.is_empty())
}

/// The updater plugin, for builds that can update.
pub fn plugin() -> Option<tauri::plugin::TauriPlugin<tauri::Wry, tauri_plugin_updater::Config>> {
    let key = PUBKEY.filter(|_| configured())?;
    Some(tauri_plugin_updater::Builder::new().pubkey(key).build())
}
