//! Where the app keeps its files. Normally the platform's folders for the app's identifier;
//! with `NOBLAME_PROFILE_DIR` set, everything goes under that folder instead (settings, layout,
//! recent repositories, the graph cache, the webview's storage) and the instance runs on its
//! own: it neither forwards to a running NoBlame nor takes later launches. End-to-end tests use
//! it so they never touch the user's settings or their running app.

use std::path::PathBuf;

use tauri::{Manager, Runtime};

/// The environment variable naming a profile folder.
pub const PROFILE_ENV: &str = "NOBLAME_PROFILE_DIR";

/// The profile folder, when one is set (an empty value counts as none).
pub fn profile_dir() -> Option<PathBuf> {
    std::env::var_os(PROFILE_ENV)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
}

/// Settings and the other JSON documents.
pub fn config_dir<R: Runtime, M: Manager<R>>(app: &M) -> tauri::Result<PathBuf> {
    match profile_dir() {
        Some(profile) => Ok(profile.join("config")),
        None => app.path().app_config_dir(),
    }
}

/// Files that can be rebuilt (the graph cache); `None` when the platform has no such folder.
pub fn cache_dir<R: Runtime, M: Manager<R>>(app: &M) -> Option<PathBuf> {
    match profile_dir() {
        Some(profile) => Some(profile.join("cache")),
        None => app.path().app_cache_dir().ok(),
    }
}

/// The webview's own storage (local storage, its caches), when a profile moves it. Left alone
/// when the environment already names one (`WEBVIEW2_USER_DATA_FOLDER`: the Edge web driver
/// picks its own and waits for the webview to start there).
pub fn webview_dir() -> Option<PathBuf> {
    if std::env::var_os(WEBVIEW2_DATA_ENV).is_some_and(|value| !value.is_empty()) {
        return None;
    }
    profile_dir().map(|profile| profile.join("webview"))
}

/// Where the Windows webview keeps its data, when the environment says.
const WEBVIEW2_DATA_ENV: &str = "WEBVIEW2_USER_DATA_FOLDER";
