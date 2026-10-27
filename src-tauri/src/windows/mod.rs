//! Windows: the main window, task windows (ADR 0015) and arguments forwarded by a second
//! launch.

pub mod commands;
mod error;
mod registry;
mod service;
mod types;

pub use error::WindowError;
pub use registry::WindowRegistry;
pub use service::{launch, on_second_instance};
pub use types::{RepositoriesRequested, WindowContext};

use tauri::{App, Manager};

/// Registers the window bookkeeping state.
pub fn init(app: &App) {
    app.manage(WindowRegistry::default());
}
