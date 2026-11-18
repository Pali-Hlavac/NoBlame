//! macOS: windows have no icon of their own, so the variant becomes the Dock icon while NoBlame
//! runs (`NSApplication.applicationIconImage`). When NoBlame is closed, the Dock and Finder show
//! the bundle's icon (cream). There is no macOS picture without a background: Free shows cream.

use objc2::rc::Retained;
use objc2::{AnyThread, MainThreadMarker};
use objc2_app_kit::{NSApplication, NSImage};
use objc2_foundation::NSData;
use tauri::WebviewWindow;

use super::AppIcon;

/// The owner's `.icns` files (`pnpm icons` copies them from `assets/logo/mac/`).
const CREAM_ICNS: &[u8] = include_bytes!("../../../icons/icon.icns");
const VIBRANT_ICNS: &[u8] = include_bytes!("../../../icons/vibrant.icns");

fn icns(icon: AppIcon) -> &'static [u8] {
    match icon {
        AppIcon::Vibrant => VIBRANT_ICNS,
        AppIcon::Cream | AppIcon::Free => CREAM_ICNS,
    }
}

fn image(icns: &[u8]) -> Option<Retained<NSImage>> {
    let data = NSData::with_bytes(icns);
    NSImage::initWithData(NSImage::alloc(), &data)
}

pub fn apply(window: &WebviewWindow, icon: AppIcon) -> tauri::Result<()> {
    window.run_on_main_thread(move || {
        let Some(main_thread) = MainThreadMarker::new() else {
            return;
        };
        let Some(image) = image(icns(icon)) else {
            tracing::warn!(?icon, "could not read the Dock icon");
            return;
        };
        let app = NSApplication::sharedApplication(main_thread);
        // SAFETY: on the main thread (the marker proves it), with an image that lives while
        // the call runs; AppKit keeps its own reference.
        unsafe { app.setApplicationIconImage(Some(&image)) };
    })
}
