//! Linux: the window icon, a 256 px PNG made by `pnpm icons` from the owner's picture in
//! `assets/logo/linux/` (the installed icon is made from the cream one).

use tauri::WebviewWindow;
use tauri::image::Image;

use super::AppIcon;

const CREAM_PNG: &[u8] = include_bytes!("../../../icons/128x128@2x.png");
const VIBRANT_PNG: &[u8] = include_bytes!("../../../icons/linux-vibrant.png");
const FREE_PNG: &[u8] = include_bytes!("../../../icons/linux-free.png");

pub fn apply(window: &WebviewWindow, icon: AppIcon) -> tauri::Result<()> {
    let png = match icon {
        AppIcon::Cream => CREAM_PNG,
        AppIcon::Vibrant => VIBRANT_PNG,
        AppIcon::Free => FREE_PNG,
    };
    window.set_icon(Image::from_bytes(png)?)
}
