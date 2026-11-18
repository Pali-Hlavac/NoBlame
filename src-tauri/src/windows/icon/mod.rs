//! The app icon chosen in Settings → Appearance: on Windows the taskbar button, Alt+Tab and the
//! title bar; on Linux the window icon; on macOS the Dock icon while NoBlame runs. The
//! installed program's icon (Explorer, the Start menu, shortcuts, Finder, the Dock while
//! NoBlame is closed) is the one built into it and stays cream.
//!
//! The pictures are the owner's, per system, in `assets/logo/{windows,mac,linux}/`;
//! `pnpm icons` puts them into `src-tauri/icons/`.

use tauri::{AppHandle, Manager, WebviewWindow};

use crate::settings::{AppIcon, SettingsStore};

#[cfg(any(windows, test))]
mod ico;

#[cfg(windows)]
#[allow(unsafe_code)]
#[path = "win32.rs"]
mod platform;

#[cfg(all(not(windows), not(target_os = "macos")))]
#[path = "linux.rs"]
mod platform;

#[cfg(target_os = "macos")]
#[allow(unsafe_code)]
#[path = "macos.rs"]
mod platform;

/// The variant chosen in Settings (cream when the settings cannot be read).
pub fn chosen(app: &AppHandle) -> AppIcon {
    app.try_state::<SettingsStore>()
        .and_then(|store| store.load().ok())
        .map(|settings| settings.app_icon)
        .unwrap_or_default()
}

/// Gives every open window `icon`.
pub fn apply_everywhere(app: &AppHandle, icon: AppIcon) {
    for window in app.webview_windows().values() {
        apply(window, icon);
    }
}

/// Gives `window` the icon `icon`; a failure is logged, the window keeps the one it had.
pub fn apply(window: &WebviewWindow, icon: AppIcon) {
    if let Err(error) = platform::apply(window, icon) {
        tracing::warn!(%error, label = window.label(), "could not change the window icon");
    }
}

#[cfg(test)]
mod tests {
    /// The owner makes the `.ico` and `.icns` files by hand; `tauri icon` would overwrite
    /// `icon.ico` and `icon.icns` with generated ones, which `scripts/icons.mjs` then replaces.
    /// Fails if that step was skipped.
    #[test]
    fn the_icons_are_the_hand_made_ones() {
        let pairs: [(&str, &[u8], &[u8]); 5] = [
            (
                "icon.ico",
                include_bytes!("../../../icons/icon.ico"),
                include_bytes!("../../../../assets/logo/windows/cream.ico"),
            ),
            (
                "vibrant.ico",
                include_bytes!("../../../icons/vibrant.ico"),
                include_bytes!("../../../../assets/logo/windows/vibrant.ico"),
            ),
            (
                "free.ico",
                include_bytes!("../../../icons/free.ico"),
                include_bytes!("../../../../assets/logo/windows/free.ico"),
            ),
            (
                "icon.icns",
                include_bytes!("../../../icons/icon.icns"),
                include_bytes!("../../../../assets/logo/mac/cream.icns"),
            ),
            (
                "vibrant.icns",
                include_bytes!("../../../icons/vibrant.icns"),
                include_bytes!("../../../../assets/logo/mac/vibrant.icns"),
            ),
        ];
        for (name, used, hand_made) in pairs {
            assert!(used == hand_made, "{name}: run `pnpm icons`");
        }
    }
}
