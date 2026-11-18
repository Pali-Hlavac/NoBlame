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

use super::AppIcon;
use super::ico::{best_image, ico, ico_images};

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
