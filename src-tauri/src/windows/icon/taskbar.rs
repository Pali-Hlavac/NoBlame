//! Which taskbar button a window belongs to (Windows). The installer gives NoBlame's shortcuts
//! an app id (the bundle identifier), a program started from them carries it, and the taskbar
//! then shows the shortcut's icon (cream), not the one the window sets. So a window showing
//! another icon gets an app id of its own, with "relaunch" properties naming that icon's file:
//! the taskbar shows it, and pinning the window pins NoBlame with that icon. Cream keeps the
//! shortcut's id, so its windows stay on the button of a pinned NoBlame.

use std::path::PathBuf;

use tauri::{Manager, WebviewWindow};
use windows::Win32::Foundation::{HWND, PROPERTYKEY};
use windows::Win32::Storage::EnhancedStorage::{
    PKEY_AppUserModel_ID, PKEY_AppUserModel_RelaunchCommand,
    PKEY_AppUserModel_RelaunchDisplayNameResource, PKEY_AppUserModel_RelaunchIconResource,
};
use windows::Win32::System::Com::StructuredStorage::{PROPVARIANT, PropVariantClear};
use windows::Win32::System::Variant::VT_LPWSTR;
use windows::Win32::UI::Shell::PropertiesSystem::{IPropertyStore, SHGetPropertyStoreForWindow};
use windows::Win32::UI::Shell::SHStrDupW;
use windows::core::HSTRING;

use super::AppIcon;
use super::ico::ico;
use crate::storage::profile;

/// Folder in the cache where the relaunch icons are written (a pinned button reads its file).
const ICON_FOLDER: &str = "taskbar-icons";

/// What the taskbar is told about a window.
pub struct Identity {
    app_id: String,
    relaunch: Option<Relaunch>,
}

struct Relaunch {
    command: String,
    name: String,
    icon: String,
}

/// The identity of a window showing `icon`; writes the icon's file when it needs one.
pub fn identity(window: &WebviewWindow, icon: AppIcon) -> Identity {
    let config = window.config();
    let installed = config.identifier.clone();
    let variant = match icon {
        AppIcon::Cream => {
            return Identity {
                app_id: installed,
                relaunch: None,
            };
        }
        AppIcon::Vibrant => "vibrant",
        AppIcon::Free => "free",
    };
    let name = config
        .product_name
        .clone()
        .unwrap_or_else(|| installed.clone());
    let relaunch = icon_file(window, icon, variant).and_then(|file| {
        let exe = std::env::current_exe().ok()?;
        Some(Relaunch {
            command: format!("\"{}\"", exe.display()),
            name,
            icon: format!("{},0", file.display()),
        })
    });
    Identity {
        app_id: format!("{installed}.{variant}"),
        relaunch,
    }
}

/// The variant's `.ico` on disk, written when missing or different.
fn icon_file(window: &WebviewWindow, icon: AppIcon, variant: &str) -> Option<PathBuf> {
    let folder = profile::cache_dir(window)?.join(ICON_FOLDER);
    let file = folder.join(format!("{variant}.ico"));
    let bytes = ico(icon);
    if std::fs::read(&file).ok().as_deref() == Some(bytes) {
        return Some(file);
    }
    let written = std::fs::create_dir_all(&folder).and_then(|()| std::fs::write(&file, bytes));
    match written {
        Ok(()) => Some(file),
        Err(error) => {
            tracing::warn!(%error, path = %file.display(), "could not write the taskbar icon");
            None
        }
    }
}

/// Tells the taskbar about `hwnd`; call on the window's thread.
pub fn set(hwnd: HWND, identity: &Identity) -> windows::core::Result<()> {
    // SAFETY: a window of this process, on its own thread (COM is initialized there by the
    // webview).
    let store: IPropertyStore = unsafe { SHGetPropertyStoreForWindow(hwnd)? };
    let relaunch = identity.relaunch.as_ref();
    set_text(
        &store,
        &PKEY_AppUserModel_RelaunchCommand,
        relaunch.map(|r| r.command.as_str()),
    )?;
    set_text(
        &store,
        &PKEY_AppUserModel_RelaunchDisplayNameResource,
        relaunch.map(|r| r.name.as_str()),
    )?;
    set_text(
        &store,
        &PKEY_AppUserModel_RelaunchIconResource,
        relaunch.map(|r| r.icon.as_str()),
    )?;
    // The id last: the taskbar reads the relaunch properties when it changes.
    set_text(&store, &PKEY_AppUserModel_ID, Some(&identity.app_id))
}

/// Sets a text property, or removes it (`None`).
fn set_text(
    store: &IPropertyStore,
    key: &PROPERTYKEY,
    value: Option<&str>,
) -> windows::core::Result<()> {
    let mut variant = PROPVARIANT::default();
    if let Some(value) = value {
        // SAFETY: a fresh string from the shell's allocator, owned by `variant` and freed by
        // `PropVariantClear` below; the union is written as the `VT_LPWSTR` case it is tagged.
        unsafe {
            let text = SHStrDupW(&HSTRING::from(value))?;
            let tagged = &mut *variant.Anonymous.Anonymous;
            tagged.vt = VT_LPWSTR;
            tagged.Anonymous.pwszVal = text;
        }
    }
    // SAFETY: `key` and `variant` live through the call; the store copies the value.
    let result = unsafe { store.SetValue(key, &raw const variant) };
    // SAFETY: `variant` is a valid PROPVARIANT (empty or the string above).
    unsafe { PropVariantClear(&raw mut variant)? };
    result
}
