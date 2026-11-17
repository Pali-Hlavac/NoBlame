//! Where windows open: the main window where it was last closed (position, size, maximized),
//! each kind of task window in the size it last had. A saved place that is no longer on a
//! screen (a monitor unplugged) is ignored and the window opens centred.

use std::collections::{BTreeMap, HashMap};
use std::sync::{Mutex, PoisonError};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow, WindowEvent};

use crate::storage::JsonFile;

mod geometry;
pub use geometry::{Area, Placement};

/// File name of the saved places inside the app config directory.
pub const PLACEMENT_FILE_NAME: &str = "window-state.json";
/// The saved document.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SavedPlacements {
    main: Option<Placement>,
    /// Size of each kind of task window, by command (`commit`); they open centred.
    tasks: BTreeMap<String, (u32, u32)>,
}

/// Managed state: the saved places and, for each open window, its last place while it was
/// neither minimized nor maximized.
pub struct Placements {
    store: JsonFile<SavedPlacements>,
    normal: Mutex<HashMap<String, Placement>>,
}

/// Which saved place a window uses.
#[derive(Debug, Clone, Copy)]
pub enum Kind<'a> {
    Main,
    /// A task window, by its command (`commit`).
    Task(&'a str),
}

impl Placements {
    pub fn new(store: JsonFile<SavedPlacements>) -> Self {
        Self {
            store,
            normal: Mutex::default(),
        }
    }

    fn saved(&self) -> SavedPlacements {
        self.store
            .load()
            .inspect_err(|error| tracing::warn!(%error, "could not read the window places"))
            .unwrap_or_default()
    }

    fn save(&self, kind: Kind<'_>, placement: Placement) {
        let mut saved = self.saved();
        match kind {
            Kind::Main => saved.main = Some(placement),
            Kind::Task(command) => {
                saved
                    .tasks
                    .insert(command.to_owned(), (placement.width, placement.height));
            }
        }
        if let Err(error) = self.store.save(&saved) {
            tracing::warn!(%error, "could not save the window places");
        }
    }
}

/// Puts a window built hidden where `kind` was last closed (call before showing it), and
/// remembers its place when it closes. Returns whether to maximize it once shown: maximizing a
/// hidden window makes Windows restore it to where it was built instead of to its saved place.
pub fn restore_and_track(app: &AppHandle, window: &WebviewWindow, kind: Kind<'_>) -> bool {
    let Some(placements) = app.try_state::<Placements>() else {
        return false;
    };
    let saved = placements.saved();
    let restored = match kind {
        Kind::Main => saved
            .main
            .and_then(|placement| placement.fitted(&screens(window))),
        Kind::Task(_) => None,
    };
    let result = match (kind, restored) {
        (Kind::Main, Some(placement)) => place(window, placement),
        (Kind::Main, None) => Ok(()),
        (Kind::Task(command), _) => saved.tasks.get(command).map_or(Ok(()), |(width, height)| {
            window
                .set_size(PhysicalSize::new(*width, *height))
                .and_then(|()| window.center())
        }),
    };
    if let Err(error) = result {
        tracing::warn!(%error, "could not restore the window's place");
    }
    // Its place now (a maximized one: where it was before), in case it closes before it moves.
    let start = normal_place(window).or(restored.map(|placement| Placement {
        maximized: false,
        ..placement
    }));
    if let Some(start) = start {
        placements
            .normal
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .insert(window.label().to_owned(), start);
    }
    track(app, window, kind);
    restored.is_some_and(|placement| placement.maximized)
}

fn place(window: &WebviewWindow, placement: Placement) -> tauri::Result<()> {
    window.set_size(PhysicalSize::new(placement.width, placement.height))?;
    window.set_position(PhysicalPosition::new(placement.x, placement.y))
}

fn screens(window: &WebviewWindow) -> Vec<Area> {
    window
        .available_monitors()
        .unwrap_or_default()
        .iter()
        // The part not taken by the taskbar or the dock.
        .map(|monitor| {
            let area = monitor.work_area();
            Area {
                x: area.position.x,
                y: area.position.y,
                width: area.size.width,
                height: area.size.height,
            }
        })
        .collect()
}

/// The window's place now, if it is neither minimized nor maximized.
fn normal_place(window: &WebviewWindow) -> Option<Placement> {
    if window.is_minimized().unwrap_or(true) || window.is_maximized().unwrap_or(true) {
        return None;
    }
    let position = window.outer_position().ok()?;
    let size = window.inner_size().ok()?;
    Some(Placement {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized: false,
    })
}

fn track(app: &AppHandle, window: &WebviewWindow, kind: Kind<'_>) {
    let handle = app.clone();
    let tracked = window.clone();
    let label = window.label().to_owned();
    let task = match kind {
        Kind::Main => None,
        Kind::Task(command) => Some(command.to_owned()),
    };
    window.on_window_event(move |event| {
        let Some(placements) = handle.try_state::<Placements>() else {
            return;
        };
        let mut normal = placements
            .normal
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        match event {
            WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                if let Some(placement) = normal_place(&tracked) {
                    normal.insert(label.clone(), placement);
                }
            }
            WindowEvent::CloseRequested { .. } => {
                let last = normal_place(&tracked).or_else(|| normal.get(&label).copied());
                drop(normal);
                if let Some(mut placement) = last {
                    placement.maximized = tracked.is_maximized().unwrap_or(false);
                    let kind = task.as_deref().map_or(Kind::Main, Kind::Task);
                    placements.save(kind, placement);
                }
            }
            WindowEvent::Destroyed => {
                normal.remove(&label);
            }
            _ => {}
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn older_files_and_missing_fields_still_load() {
        let saved: SavedPlacements = serde_json::from_str(
            r#"{ "main": { "x": 1, "y": 2, "width": 3, "height": 4 }, "unknown": true }"#,
        )
        .unwrap_or_default();
        assert_eq!(saved.main.map(|main| main.maximized), Some(false));
        assert!(saved.tasks.is_empty());
    }
}
