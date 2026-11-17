//! Where a saved window place lands on today's screens: kept, fitted, or not used.

use serde::{Deserialize, Serialize};

/// How much of a window (physical pixels) must be on a screen for its saved place to be used:
/// enough of the title bar to grab it.
const MIN_VISIBLE_PX: (i64, i64) = (120, 40);

/// A window's place on the desktop, in physical pixels.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Placement {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    /// Maximized when it closed; `x` to `height` are then its place before.
    #[serde(default)]
    pub maximized: bool,
}

/// A rectangle on the desktop (a monitor's work area), in physical pixels.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Area {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl Placement {
    /// Whether enough of the window's top would be on one of `screens` to grab it.
    #[cfg(test)]
    pub fn is_on(&self, screens: &[Area]) -> bool {
        self.screen_of(screens).is_some()
    }

    /// The place on `screens`: `None` when too little of its top would be on any, else
    /// shrunk to fit the screen it is on and moved back inside it.
    pub fn fitted(&self, screens: &[Area]) -> Option<Self> {
        let screen = self.screen_of(screens)?;
        let width = self.width.min(screen.width);
        let height = self.height.min(screen.height);
        let fit = |start: i32, length: u32, area_start: i32, area_length: u32| -> i32 {
            let end = i64::from(area_start) + i64::from(area_length) - i64::from(length);
            let start = i64::from(start).min(end).max(i64::from(area_start));
            i32::try_from(start).unwrap_or(area_start)
        };
        Some(Self {
            x: fit(self.x, width, screen.x, screen.width),
            y: fit(self.y, height, screen.y, screen.height),
            width,
            height,
            maximized: self.maximized,
        })
    }

    /// The screen holding most of the window's top edge, if enough of it to grab.
    fn screen_of(&self, screens: &[Area]) -> Option<Area> {
        screens
            .iter()
            .copied()
            .filter_map(|screen| {
                let left = i64::from(self.x.max(screen.x));
                let right = (i64::from(self.x) + i64::from(self.width))
                    .min(i64::from(screen.x) + i64::from(screen.width));
                let top = i64::from(self.y.max(screen.y));
                let bottom = (i64::from(self.y) + i64::from(self.height))
                    .min(i64::from(screen.y) + i64::from(screen.height));
                // The top edge itself must be on the screen, not only a corner further down.
                let top_on_screen = self.y >= screen.y
                    && i64::from(self.y) < i64::from(screen.y) + i64::from(screen.height);
                let grabbable =
                    right - left >= MIN_VISIBLE_PX.0 && bottom - top >= MIN_VISIBLE_PX.1;
                (top_on_screen && grabbable).then_some((right - left, screen))
            })
            .max_by_key(|(overlap, _)| *overlap)
            .map(|(_, screen)| screen)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SCREEN: Area = Area {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
    };
    const LEFT_SCREEN: Area = Area {
        x: -1280,
        y: 0,
        width: 1280,
        height: 1024,
    };

    fn at(x: i32, y: i32) -> Placement {
        Placement {
            x,
            y,
            width: 1200,
            height: 800,
            maximized: false,
        }
    }

    #[test]
    fn a_window_on_a_screen_keeps_its_place() {
        assert!(at(100, 100).is_on(&[SCREEN]));
        assert!(at(-1000, 50).is_on(&[SCREEN, LEFT_SCREEN]));
        // Mostly off the right edge, but its title bar's left part can still be grabbed.
        assert!(at(1700, 10).is_on(&[SCREEN]));
    }

    #[test]
    fn a_window_off_every_screen_is_not_restored_there() {
        // The left monitor was unplugged: 100 px are left on the other one.
        assert!(!at(-1100, 50).is_on(&[SCREEN]));
        // Only a sliver on screen, or the title bar above the top.
        assert!(!at(1850, 10).is_on(&[SCREEN]));
        assert!(!at(100, -300).is_on(&[SCREEN]));
        assert!(!at(100, 1060).is_on(&[SCREEN]));
        assert!(!at(100, 100).is_on(&[]));
    }

    #[test]
    fn a_window_bigger_than_its_screen_is_shrunk_and_moved_onto_it() {
        let huge = Placement {
            x: 1500,
            y: 100,
            width: 2400,
            height: 9000,
            maximized: true,
        };
        assert_eq!(
            huge.fitted(&[SCREEN]),
            Some(Placement {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
                maximized: true,
            })
        );
        // One that fits stays where it was; off-screen ones are not placed at all.
        assert_eq!(at(100, 100).fitted(&[SCREEN]), Some(at(100, 100)));
        assert_eq!(at(-1100, 50).fitted(&[SCREEN]), None);
        // Mostly on the left monitor: moved fully onto it.
        assert_eq!(
            at(-1000, 50).fitted(&[SCREEN, LEFT_SCREEN]).map(|p| p.x),
            Some(-1200)
        );
    }
}
