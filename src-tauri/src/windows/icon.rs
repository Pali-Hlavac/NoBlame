//! The app icon a window shows (Settings → Appearance): the taskbar button, Alt+Tab and the
//! title bar on Windows, the window icon on Linux. The installed program's icon (Explorer,
//! the Start menu, a pinned shortcut, the macOS Dock) is the one built into it and stays.
//!
//! Each variant is a hand-made `.ico` with every size drawn for it; Windows gets the size it
//! asks for, so 16 px stays sharp instead of scaled down from 256.

use tauri::{AppHandle, Manager, WebviewWindow};

use crate::settings::{AppIcon, SettingsStore};

/// The hand-made icon of each variant (`pnpm icons` copies them from `assets/logo/`).
const GOLDEN_ICO: &[u8] = include_bytes!("../../icons/icon.ico");
const VIBRANT_ICO: &[u8] = include_bytes!("../../icons/vibrant.ico");

/// Bytes of an `.ico` header and of each directory entry after it.
const ICO_HEADER_LEN: usize = 6;
const ICO_ENTRY_LEN: usize = 16;
/// An entry's width of 0 means 256 px.
const ICO_FULL_SIZE: u32 = 256;
/// Every PNG starts with these bytes; the other entries are bitmaps.
const PNG_SIGNATURE: &[u8] = b"\x89PNG";

fn ico(icon: AppIcon) -> &'static [u8] {
    match icon {
        AppIcon::Golden => GOLDEN_ICO,
        AppIcon::Vibrant => VIBRANT_ICO,
    }
}

/// One picture in an `.ico`: its size in pixels (square) and its bytes (a PNG or a bitmap).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IcoImage<'a> {
    pub size: u32,
    pub data: &'a [u8],
}

impl IcoImage<'_> {
    fn is_png(&self) -> bool {
        self.data.starts_with(PNG_SIGNATURE)
    }
}

/// The pictures in an `.ico` file, skipping entries that point outside it.
pub fn ico_images(ico: &[u8]) -> Vec<IcoImage<'_>> {
    let Some(count) = ico.get(4..ICO_HEADER_LEN) else {
        return Vec::new();
    };
    let count = usize::from(u16::from_le_bytes([count[0], count[1]]));
    (0..count)
        .filter_map(|index| {
            let start = ICO_HEADER_LEN + index * ICO_ENTRY_LEN;
            let entry = ico.get(start..start + ICO_ENTRY_LEN)?;
            let size = match entry[0] {
                0 => ICO_FULL_SIZE,
                width => u32::from(width),
            };
            let len = u32::from_le_bytes([entry[8], entry[9], entry[10], entry[11]]);
            let offset = u32::from_le_bytes([entry[12], entry[13], entry[14], entry[15]]);
            let start = usize::try_from(offset).ok()?;
            let end = start.checked_add(usize::try_from(len).ok()?)?;
            Some(IcoImage {
                size,
                data: ico.get(start..end)?,
            })
        })
        .collect()
}

/// The picture to show at `wanted` pixels: the smallest that is at least that big (scaled
/// down looks better than scaled up), else the biggest. Among equal sizes a PNG wins.
pub fn best_image<'a>(images: &[IcoImage<'a>], wanted: u32) -> Option<IcoImage<'a>> {
    let key = |image: &IcoImage<'_>| (image.size, !image.is_png());
    images
        .iter()
        .filter(|image| image.size >= wanted)
        .min_by_key(|image| key(image))
        .or_else(|| {
            images
                .iter()
                .max_by_key(|image| (image.size, image.is_png()))
        })
        .copied()
}

/// The variant chosen in Settings (the golden one when the settings cannot be read).
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

#[cfg(windows)]
#[allow(unsafe_code)]
mod platform {
    //! Windows asks a window for a big icon (taskbar, Alt+Tab) and a small one (title bar), each
    //! in its own size for the display's scaling; both come from the `.ico`'s own pictures.

    use std::collections::HashMap;
    use std::sync::{Mutex, OnceLock};

    use tauri::WebviewWindow;
    use windows_sys::Win32::UI::HiDpi::{GetDpiForWindow, GetSystemMetricsForDpi};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateIconFromResourceEx, ICON_BIG, ICON_SMALL, LR_DEFAULTCOLOR, SM_CXICON, SM_CXSMICON,
        SendMessageW, WM_SETICON,
    };

    use super::{AppIcon, best_image, ico, ico_images};

    /// The format version `CreateIconFromResourceEx` expects.
    const ICON_FORMAT_VERSION: u32 = 0x0003_0000;

    /// Icons made so far, by variant and size, kept for the app's life: a window may still show
    /// one, and there are only a few.
    fn made() -> &'static Mutex<HashMap<(AppIcon, i32), isize>> {
        static MADE: OnceLock<Mutex<HashMap<(AppIcon, i32), isize>>> = OnceLock::new();
        MADE.get_or_init(Mutex::default)
    }

    fn icon_handle(icon: AppIcon, size: i32) -> Option<isize> {
        let mut made = made().lock().ok()?;
        if let Some(handle) = made.get(&(icon, size)) {
            return Some(*handle);
        }
        let images = ico_images(ico(icon));
        let image = best_image(&images, u32::try_from(size).ok()?)?;
        let len = u32::try_from(image.data.len()).ok()?;
        // SAFETY: the bytes are one picture of an `.ico` (a PNG or a DIB), which is what the
        // function reads; it copies them into the new icon.
        let handle = unsafe {
            CreateIconFromResourceEx(
                image.data.as_ptr(),
                len,
                1,
                ICON_FORMAT_VERSION,
                size,
                size,
                LR_DEFAULTCOLOR,
            )
        };
        if handle.is_null() {
            return None;
        }
        let handle = handle as isize;
        made.insert((icon, size), handle);
        Some(handle)
    }

    pub fn apply(window: &WebviewWindow, icon: AppIcon) -> tauri::Result<()> {
        // Kept as a number to cross to the main thread, which owns the window.
        let hwnd = window.hwnd()?.0 as isize;
        window.run_on_main_thread(move || {
            let hwnd = hwnd as windows_sys::Win32::Foundation::HWND;
            // SAFETY: plain Win32 calls on a window of this process, on its own thread.
            unsafe {
                let dpi = GetDpiForWindow(hwnd);
                for (kind, metric) in [(ICON_BIG, SM_CXICON), (ICON_SMALL, SM_CXSMICON)] {
                    let size = GetSystemMetricsForDpi(metric, dpi);
                    if let Some(handle) = icon_handle(icon, size) {
                        SendMessageW(hwnd, WM_SETICON, kind as usize, handle);
                    }
                }
            }
        })
    }
}

#[cfg(all(not(windows), not(target_os = "macos")))]
mod platform {
    //! Linux: the window icon, from the `.ico`'s biggest PNG.

    use tauri::WebviewWindow;
    use tauri::image::Image;

    use super::{AppIcon, ico, ico_images};

    pub fn apply(window: &WebviewWindow, icon: AppIcon) -> tauri::Result<()> {
        let images = ico_images(ico(icon));
        let png = images
            .iter()
            .filter(|image| image.is_png())
            .max_by_key(|image| image.size);
        match png {
            Some(png) => window.set_icon(Image::from_bytes(png.data)?),
            None => Ok(()),
        }
    }
}

#[cfg(target_os = "macos")]
mod platform {
    //! macOS windows have no icon of their own; the Dock shows the app's.

    use tauri::WebviewWindow;

    use super::AppIcon;

    pub fn apply(_window: &WebviewWindow, _icon: AppIcon) -> tauri::Result<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used)]
    use super::*;

    #[test]
    fn every_variant_has_the_sizes_windows_asks_for() {
        for icon in [AppIcon::Golden, AppIcon::Vibrant] {
            let images = ico_images(ico(icon));
            let sizes: Vec<u32> = images.iter().map(|image| image.size).collect();
            for wanted in [16, 24, 32, 48, 64, 256] {
                assert!(
                    sizes.contains(&wanted),
                    "{icon:?} lacks {wanted} px: {sizes:?}"
                );
            }
            assert!(images.iter().any(IcoImage::is_png), "{icon:?} has no PNG");
        }
    }

    #[test]
    fn the_best_picture_is_the_smallest_big_enough_one() {
        let bitmap = [0_u8; 4];
        let png = b"\x89PNG....";
        let images = [
            IcoImage {
                size: 16,
                data: &bitmap,
            },
            IcoImage {
                size: 32,
                data: &bitmap,
            },
            IcoImage {
                size: 256,
                data: &bitmap,
            },
            IcoImage {
                size: 256,
                data: png,
            },
        ];
        assert_eq!(best_image(&images, 16).map(|i| i.size), Some(16));
        assert_eq!(best_image(&images, 20).map(|i| i.size), Some(32));
        let biggest = best_image(&images, 100).unwrap();
        assert!(biggest.is_png());
        assert!(best_image(&images, 512).unwrap().is_png());
        assert_eq!(best_image(&[], 16), None);
    }

    #[test]
    fn a_broken_file_has_no_pictures() {
        assert!(ico_images(b"").is_empty());
        // One entry pointing past the end.
        let mut broken = vec![0, 0, 1, 0, 1, 0];
        broken.extend_from_slice(&[16, 16, 0, 0, 1, 0, 32, 0, 100, 0, 0, 0, 22, 0, 0, 0]);
        assert!(ico_images(&broken).is_empty());
    }
}
