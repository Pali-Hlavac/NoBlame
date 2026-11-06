//! Library root: wires modules, the typed IPC builder and the Tauri runtime together.
//! See `docs/architecture/overview.md`.

mod app_info;
mod branches;
pub mod cli;
pub mod error;
mod git_env;
mod inspect;
mod ipc;
mod jobs;
mod logging;
mod repository;
mod settings;
pub mod storage;
mod windows;
mod workbench;
mod worktree;

use cli::LaunchRequest;

/// Starts the desktop application for `request`, or forwards `request` to an instance that
/// is already running and returns. Blocks until the last window closes.
pub fn run(request: LaunchRequest) {
    logging::init();
    let builder = ipc::builder();

    #[cfg(debug_assertions)]
    if let Err(error) = ipc::export_bindings(&builder) {
        tracing::warn!(%error, "failed to export TypeScript bindings");
    }

    let result = tauri::Builder::default()
        // Must be the first plugin: a second launch forwards its arguments and exits here.
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            windows::on_second_instance(app, argv, &cwd);
        }))
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            settings::init(app)?;
            repository::init(app)?;
            workbench::init(app)?;
            jobs::init(app);
            windows::init(app);
            windows::launch(app.handle(), request)?;
            Ok(())
        })
        .run(tauri::generate_context!());

    if let Err(error) = result {
        tracing::error!(%error, "application exited with an error");
        std::process::exit(1);
    }
}
