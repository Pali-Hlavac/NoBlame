//! Background jobs (ADR 0011): git commands that talk to remotes run in the background with
//! progress, a log and cancel (git's whole process tree is killed). Fetch is the first;
//! pull, push and clone follow. See `docs/architecture/background-jobs.md`.

pub mod commands;
mod fetch;
mod registry;
mod types;

use std::sync::Arc;

use tauri::{App, Manager};

use crate::askpass::Askpass;

pub use registry::JobRegistry;
pub use types::JobUpdated;

/// Starts the askpass service and makes it and the job registry available to commands.
pub fn init(app: &App) {
    let askpass = Askpass::start(app.handle().clone());
    app.manage(Arc::clone(&askpass));
    app.manage(Arc::new(JobRegistry::new(app.handle().clone(), askpass)));
}
