//! Build script: generates the Tauri context and one ACL permission per app command.
//!
//! Every app command must be listed in `APP_COMMANDS`; Tauri then generates an
//! `allow-<command>` permission that has to be granted in `capabilities/`.
//! Unlisted commands are rejected at runtime.

const APP_COMMANDS: &[&str] = &[
    "get_app_info",
    "get_settings",
    "update_settings",
    "get_git_info",
    "get_window_context",
    "take_repository_requests",
    "open_task_window",
    "open_repository",
    "init_repository",
    "close_repository",
    "load_graph",
    "get_graph_block",
    "reload_graph",
    "set_graph_filter",
    "find_commit",
    "go_to_commit",
    "refresh_repository",
    "get_ancestry_block",
    "get_commit_rows",
    "write_commit_graph",
    "list_recent_repositories",
    "remove_recent_repository",
    "get_commit_details",
    "get_changed_files",
    "get_file_diff",
    "get_diff_lines",
    "get_split_diff_lines",
    "find_diff_row",
    "get_file_contents",
    "list_refs",
    "list_stashes",
    "get_status_summary",
    "list_submodules",
    "get_workbench_layout",
    "save_workbench_layout",
];

/// Common-Controls v6 manifest, embedded into every linked artifact on Windows.
const WINDOWS_MANIFEST: &str = "windows-app-manifest.xml";
/// Icon embedded into the Windows executable (`pnpm icons` replaces it).
const WINDOWS_ICON: &str = "icons/icon.ico";

fn main() {
    // tauri-build embeds the icon but does not ask cargo to watch it, so a new icon would only
    // appear after an unrelated change.
    println!("cargo:rerun-if-changed={WINDOWS_ICON}");
    let mut windows = tauri_build::WindowsAttributes::new();
    if is_windows_msvc_target() {
        // Tauri only embeds the manifest into the app binary, so `cargo test` executables
        // crash with STATUS_ENTRYPOINT_NOT_FOUND. Embedding it via the linker covers both.
        windows = tauri_build::WindowsAttributes::new_without_app_manifest();
        println!("cargo:rerun-if-changed={WINDOWS_MANIFEST}");
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
        let manifest = std::path::Path::new(&manifest_dir).join(WINDOWS_MANIFEST);
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    }

    let attributes = tauri_build::Attributes::new()
        .windows_attributes(windows)
        .app_manifest(tauri_build::AppManifest::new().commands(APP_COMMANDS));
    if let Err(error) = tauri_build::try_build(attributes) {
        panic!("tauri build script failed: {error:#}");
    }
}

fn is_windows_msvc_target() -> bool {
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_env = std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();
    target_os == "windows" && target_env == "msvc"
}
