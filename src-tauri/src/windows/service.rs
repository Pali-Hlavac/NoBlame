//! Opening the main window and task windows for a [`LaunchRequest`].

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_specta::Event;

use super::registry::MAIN_WINDOW_LABEL;
use super::{RepositoriesRequested, WindowContext, WindowError, WindowRegistry};
use crate::cli::{self, LaunchRequest, LaunchTarget, TaskKind};

/// Logical size (width, height) of a new main window and its minimum.
const MAIN_WINDOW_SIZE: (f64, f64) = (1280.0, 800.0);
const MAIN_WINDOW_MIN_SIZE: (f64, f64) = (900.0, 600.0);
/// Logical size of a new task window and its minimum.
const TASK_WINDOW_SIZE: (f64, f64) = (1000.0, 700.0);
const TASK_WINDOW_MIN_SIZE: (f64, f64) = (640.0, 480.0);
/// Where the macOS traffic lights sit: vertically centred in the 36 px title bar (`TitleBar.tsx`).
#[cfg(target_os = "macos")]
const TRAFFIC_LIGHTS_POSITION: (f64, f64) = (14.0, 12.0);

/// Opens whatever `request` asks for: the main window (queueing its repository) or a task
/// window.
pub fn launch(app: &AppHandle, request: LaunchRequest) -> Result<(), WindowError> {
    match (request.target, request.path) {
        (LaunchTarget::Main, None) => show_main_window(app),
        (LaunchTarget::Main, Some(path)) => {
            app.state::<WindowRegistry>()
                .request_repository(path_string(path)?);
            show_main_window(app)?;
            // A main window that is still loading drains the queue on start instead.
            RepositoriesRequested.emit(app)?;
            Ok(())
        }
        (LaunchTarget::Task(task), Some(path)) => {
            open_task_window(app, task, path_string(path)?).map(|_| ())
        }
        (LaunchTarget::Task(_), None) => Err(WindowError::MissingPath),
    }
}

/// Handles the arguments a second `noblame` launch forwarded to this instance.
pub fn on_second_instance(app: &AppHandle, argv: Vec<String>, cwd: &str) {
    tracing::info!(?argv, cwd, "second launch forwarded its arguments");
    let result = match cli::parse(argv, Path::new(cwd)) {
        Ok(request) => launch(app, request),
        // The second process validated its arguments before forwarding them, so this is
        // unexpected; bring the app to the front rather than doing nothing.
        Err(error) => {
            tracing::warn!(%error, "ignoring an invalid forwarded command line");
            show_main_window(app)
        }
    };
    if let Err(error) = result {
        tracing::error!(%error, "could not open the requested window");
    }
}

/// Focuses the main window, creating it if it is not open.
pub fn show_main_window(app: &AppHandle) -> Result<(), WindowError> {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        window.unminimize()?;
        window.show()?;
        window.set_focus()?;
        return Ok(());
    }
    let builder = WebviewWindowBuilder::new(app, MAIN_WINDOW_LABEL, WebviewUrl::default())
        .title(&app.package_info().name)
        .inner_size(MAIN_WINDOW_SIZE.0, MAIN_WINDOW_SIZE.1)
        .min_inner_size(MAIN_WINDOW_MIN_SIZE.0, MAIN_WINDOW_MIN_SIZE.1)
        .center()
        // Tauri's file-drop handler swallows HTML drag and drop on Windows, which the docks
        // need for moving tabs. Dropping folders onto the window can use HTML events later.
        .disable_drag_drop_handler();
    with_custom_title_bar(builder).build()?;
    Ok(())
}

/// The main window draws its own title bar (with the toolbar in it, see `TitleBar.tsx`). macOS
/// keeps the traffic lights over a transparent title bar; elsewhere the window has no system
/// frame and the UI draws minimize, maximize and close.
fn with_custom_title_bar<R: tauri::Runtime, M: Manager<R>>(
    builder: WebviewWindowBuilder<'_, R, M>,
) -> WebviewWindowBuilder<'_, R, M> {
    #[cfg(target_os = "macos")]
    {
        builder
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true)
            .traffic_light_position(tauri::LogicalPosition::new(
                TRAFFIC_LIGHTS_POSITION.0,
                TRAFFIC_LIGHTS_POSITION.1,
            ))
    }
    #[cfg(not(target_os = "macos"))]
    {
        builder.decorations(false)
    }
}

/// Opens a new window for `task` on `path` and returns its label. Call it from async
/// commands only: creating a window inside a sync command deadlocks on Windows.
pub fn open_task_window(
    app: &AppHandle,
    task: TaskKind,
    path: String,
) -> Result<String, WindowError> {
    let title = format!(
        "{} — {} — {}",
        task.title(),
        display_name(&path),
        app.package_info().name
    );
    let registry = app.state::<WindowRegistry>();
    let label = registry.register_task(WindowContext::Task { task, path });
    let built = WebviewWindowBuilder::new(app, &label, WebviewUrl::default())
        .title(title)
        .inner_size(TASK_WINDOW_SIZE.0, TASK_WINDOW_SIZE.1)
        .min_inner_size(TASK_WINDOW_MIN_SIZE.0, TASK_WINDOW_MIN_SIZE.1)
        .center()
        .disable_drag_drop_handler()
        .build();
    let window = match built {
        Ok(window) => window,
        Err(error) => {
            registry.forget(&label);
            return Err(error.into());
        }
    };
    let handle = app.clone();
    let closed_label = label.clone();
    window.on_window_event(move |event| {
        if matches!(event, WindowEvent::Destroyed) {
            handle.state::<WindowRegistry>().forget(&closed_label);
        }
    });
    Ok(label)
}

/// Paths cross the IPC boundary as strings; refuse the (rare) ones that are not Unicode
/// instead of silently changing them.
fn path_string(path: PathBuf) -> Result<String, WindowError> {
    path.into_os_string()
        .into_string()
        .map_err(|raw| WindowError::NonUnicodePath(raw.into()))
}

/// Last component of `path` for window titles, or the whole path for roots.
fn display_name(path: &str) -> &str {
    Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn window_titles_use_the_last_path_component() {
        let path = std::env::temp_dir().join("my-repo");
        assert_eq!(display_name(path.to_str().unwrap()), "my-repo");
        assert_eq!(display_name("/"), "/");
    }
}
