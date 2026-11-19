//! Background jobs (ADR 0011): git commands that talk to remotes run in the background with
//! progress, a log and cancel (git's whole process tree is killed): fetch, pull, push and
//! clone, submodule updates, archives (`archive.rs`) LFS downloads (`lfs.rs`), user scripts (`script.rs`), and asking a remote without fetching
//! (`remote_check.rs`). See `docs/architecture/background-jobs.md`.

mod archive;
mod clone;
pub mod commands;
mod failure;
mod fetch;
mod lfs;
mod registry;
mod remote_check;
mod script;
mod steps;
mod submodules;
mod sync;
mod target;
mod types;

use std::sync::Arc;

use tauri::{App, Manager};

use crate::askpass::Askpass;

pub use registry::JobRegistry;
pub use submodules::follow as follow_submodules;
pub use types::JobUpdated;

/// Starts the askpass service and makes it and the job registry available to commands.
pub fn init(app: &App) {
    let askpass = Askpass::start(app.handle().clone());
    app.manage(Arc::clone(&askpass));
    app.manage(Arc::new(JobRegistry::new(app.handle().clone(), askpass)));
}
