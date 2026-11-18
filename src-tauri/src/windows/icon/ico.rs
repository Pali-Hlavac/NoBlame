//! Windows' icons: one hand-made `.ico` per variant with every size drawn for it, so 16 px
//! stays sharp instead of scaled down from 256. Reads the pictures in an `.ico` and picks the
//! one for a size.

use crate::settings::AppIcon;

/// The hand-made icon of each variant (`pnpm icons` copies them from `assets/logo/windows/`).
const CREAM_ICO: &[u8] = include_bytes!("../../../icons/icon.ico");
const VIBRANT_ICO: &[u8] = include_bytes!("../../../icons/vibrant.ico");
const FREE_ICO: &[u8] = include_bytes!("../../../icons/free.ico");

/// Bytes of an `.ico` header and of each directory entry after it.
const ICO_HEADER_LEN: usize = 6;
const ICO_ENTRY_LEN: usize = 16;
/// An entry's width of 0 means 256 px.
const ICO_FULL_SIZE: u32 = 256;
/// Every PNG starts with these bytes; the other entries are bitmaps.
const PNG_SIGNATURE: &[u8] = b"\x89PNG";

/// The hand-made `.ico` of a variant.
pub fn ico(icon: AppIcon) -> &'static [u8] {
    match icon {
        AppIcon::Cream => CREAM_ICO,
        AppIcon::Vibrant => VIBRANT_ICO,
        AppIcon::Free => FREE_ICO,
    }
}

/// One picture in an `.ico`: its size in pixels (square) and its bytes (a PNG or a bitmap).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IcoImage<'a> {
    pub size: u32,
    pub data: &'a [u8],
}

impl IcoImage<'_> {
    pub fn is_png(&self) -> bool {
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

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used)]
    use super::*;

    #[test]
    fn every_variant_has_the_sizes_windows_asks_for() {
        for icon in [AppIcon::Cream, AppIcon::Vibrant, AppIcon::Free] {
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
