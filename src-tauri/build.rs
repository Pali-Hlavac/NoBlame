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
    "get_repository_groups",
    "save_repository_groups",
    "get_commit_details",
    "verify_commit_signature",
    "get_changed_files",
    "get_comparison",
    "count_ahead_behind",
    "get_file_diff",
    "get_diff_lines",
    "get_split_diff_lines",
    "find_diff_row",
    "get_file_contents",
    "get_tree_entry",
    "list_tree",
    "get_file_history",
    "get_file_history_rows",
    "get_blame",
    "get_file_view",
    "get_file_view_lines",
    "save_file_as",
    "list_refs",
    "list_stashes",
    "list_submodules",
    "get_status",
    "get_change_counts",
    "checkout_branch",
    "checkout_commit",
    "create_branch",
    "rename_branch",
    "get_unique_commits",
    "delete_ref",
    "create_tag",
    "get_upstreams",
    "get_ahead_behind",
    "set_upstream",
    "get_missing_commits",
    "list_jobs",
    "get_job_output",
    "cancel_job",
    "fetch_repository",
    "pull_repository",
    "push_repository",
    "push_current_branch",
    "list_remotes",
    "clone_repository",
    "list_remote_details",
    "add_remote",
    "edit_remote",
    "remove_remote",
    "list_credential_requests",
    "answer_credential",
    "get_worktree_file_id",
    "get_worktree_file_contents",
    "stage_files",
    "stage_all_files",
    "unstage_files",
    "unstage_all_files",
    "create_commit",
    "get_head_message",
    "get_commit_defaults",
    "get_recent_messages",
    "stage_lines",
    "unstage_lines",
    "discard_lines",
    "discard_files",
    "stash_changes",
    "apply_stash",
    "drop_stash",
    "get_stash_files",
    "apply_stash_files",
    "preview_ignore",
    "ignore_files",
    "open_worktree_file",
    "show_worktree_file",
    "merge_into_current",
    "step_operation",
    "pick_commit",
    "reset_current",
    "rebase_current",
    "get_rebase_preview",
    "get_conflicts",
    "take_conflict_side",
    "open_merge_tool",
    "get_merge_file",
    "get_interactive_plan",
    "get_reflog",
    "rebase_interactive",
    "save_merged_file",
    "open_external_diff",
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
