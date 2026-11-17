//! Tauri boundary for app information.

use tauri::AppHandle;

use super::AppInfo;

/// The licences of the open-source software NoBlame includes (`pnpm licences`); also installed
/// beside the app as `third-party-notices.txt`.
const THIRD_PARTY_NOTICES: &str = include_str!("../../resources/third-party-notices.txt");

/// Returns the third-party notices (About → Third-party licences).
#[tauri::command]
#[specta::specta]
pub async fn get_third_party_notices() -> String {
    THIRD_PARTY_NOTICES.to_owned()
}

/// Returns the app name, version and platform.
#[tauri::command]
#[specta::specta]
pub fn get_app_info(app: AppHandle) -> AppInfo {
    let package = app.package_info();
    AppInfo::new(package.name.clone(), package.version.to_string())
}
