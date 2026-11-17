//! Library root: wires modules, the typed IPC builder and the Tauri runtime together.
//! See `docs/architecture/overview.md`.

mod app_info;
mod askpass;
mod branches;
pub mod cli;
pub mod error;
mod git_config;
mod git_env;
mod inspect;
mod ipc;
mod jobs;
mod lfs;
mod logging;
mod operations;
mod patches;
mod repository;
mod settings;
pub mod storage;
mod updates;
mod windows;
mod workbench;
mod worktree;
mod worktrees;

use cli::LaunchRequest;

/// When this process was started by git or ssh as the askpass program of a job, answers the
/// prompt through the running app and returns the exit code; `None` for a normal launch.
/// Called first thing in `main`, before the command line is parsed.
pub fn askpass_helper() -> Option<i32> {
    askpass::run_if_helper()
}

/// Starts the desktop application for `request`, or forwards `request` to an instance that
/// is already running and returns. Blocks until the last window closes.
pub fn run(request: LaunchRequest) {
    logging::init();
    let builder = ipc::builder();

    #[cfg(debug_assertions)]
    if let Err(error) = ipc::export_bindings(&builder) {
        tracing::warn!(%error, "failed to export TypeScript bindings");
    }

    let mut app = tauri::Builder::default();
    // Must be the first plugin: a second launch forwards its arguments and exits here. An
    // instance with its own profile (tests) runs on its own.
    if storage::profile::profile_dir().is_none() {
        app = app.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            windows::on_second_instance(app, argv, &cwd);
        }));
    }
    // Only release builds carrying an update key can update (ADR 0017).
    if let Some(updater) = updates::plugin() {
        app = app.plugin(updater);
    }
    let result = app
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            tauri::Manager::manage(app, updates::PendingUpdate::default());
            settings::init(app)?;
            repository::init(app)?;
            workbench::init(app)?;
            jobs::init(app);
            windows::init(app)?;
            windows::launch(app.handle(), request)?;
            Ok(())
        })
        .run(tauri::generate_context!());

    if let Err(error) = result {
        tracing::error!(%error, "application exited with an error");
        std::process::exit(1);
    }
}
