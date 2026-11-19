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

/// The webview's own storage (local storage, its caches): the folder the environment names
/// (`WEBVIEW2_USER_DATA_FOLDER`: the Edge web driver picks its own and waits for the webview to
/// start there), else the profile's when a profile is set, else the default.
pub fn webview_dir() -> Option<PathBuf> {
    env_value(WEBVIEW2_DATA_ENV)
        .map(PathBuf::from)
        .or_else(|| profile_dir().map(|profile| profile.join("webview")))
}

/// Arguments for the Windows webview the environment asks for
/// (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`: the Edge web driver's `--remote-debugging-port`),
/// after the ones wry passes by default (giving any replaces those). The webview reads both
/// variables itself on most machines, but ignored them on GitHub's Windows runners, so the
/// end-to-end tests never reached it there; passed explicitly they work everywhere. Nobody sets
/// them in normal use.
pub fn webview_args() -> Option<String> {
    env_value(WEBVIEW2_ARGS_ENV).map(|extra| format!("{WRY_DEFAULT_ARGS} {extra}"))
}

fn env_value(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .filter(|value| !value.trim().is_empty())
}

/// Where the Windows webview keeps its data, when the environment says.
const WEBVIEW2_DATA_ENV: &str = "WEBVIEW2_USER_DATA_FOLDER";
/// Extra arguments for the Windows webview, when the environment says.
const WEBVIEW2_ARGS_ENV: &str = "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS";
/// What wry passes when an app gives no arguments (wry 0.57, `webview2/mod.rs`): no mini menu or
/// smart screen, and autoplay, which Tauri turns on.
const WRY_DEFAULT_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --autoplay-policy=no-user-gesture-required";
