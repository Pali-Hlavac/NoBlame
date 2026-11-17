//! Windows: the main window, task windows (ADR 0015) and arguments forwarded by a second
//! launch.

pub mod commands;
mod error;
mod icon;
mod placement;
mod registry;
mod service;
mod types;

pub use error::WindowError;
pub use icon::apply_everywhere as apply_app_icon;
pub use registry::{MAIN_WINDOW_LABEL, WindowRegistry};
pub use service::{launch, on_second_instance};
pub use types::{RepositoriesRequested, WindowContext};

use tauri::{App, Manager};

use crate::storage::JsonFile;

/// Registers the window bookkeeping state and where windows were last closed.
pub fn init(app: &App) -> tauri::Result<()> {
    app.manage(WindowRegistry::default());
    let path = app
        .path()
        .app_config_dir()?
        .join(placement::PLACEMENT_FILE_NAME);
    app.manage(placement::Placements::new(JsonFile::new(path)));
    Ok(())
}
