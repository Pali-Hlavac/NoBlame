//! Tauri boundary for the read-only repository views.

use tauri::{State, WebviewWindow};

use super::{
    ChangedFilesDto, CommitDetailsDto, DiffLineDto, DiffRequestDto, FileDiffDto, FileHistoryDto,
    FileHistoryRowDto, FileViewRequestDto, LineSideDto, RefEntry, SplitLineDto, StashDto,
    StatusSummaryDto, SubmoduleDto, TreeEntryDto, TreeListingDto, files, history, service,
};
use crate::error::CommandResult;
use crate::repository::{RawBytes, RepoId, RepoSessions};
use crate::settings::DiffLayout;

/// Details of the commit on `row`: message, people, parents, refs and refs containing it.
#[tauri::command]
#[specta::specta]
pub async fn get_commit_details(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    row: u32,
) -> CommandResult<CommitDetailsDto> {
    Ok(service::details(&sessions, id, row).await?)
}

/// The files the commit on `row` changed against its parent number `parent` (0 = first).
#[tauri::command]
#[specta::specta]
pub async fn get_changed_files(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    row: u32,
    parent: u32,
) -> CommandResult<ChangedFilesDto> {
    Ok(service::changed_files(&sessions, id, row, parent).await?)
}

/// The line diff a request names (two blobs, the file's path, the options): its kind, sizes
/// and row counts. Rows come from `get_diff_lines` or `get_split_diff_lines`.
#[tauri::command]
#[specta::specta]
pub async fn get_file_diff(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: DiffRequestDto,
) -> CommandResult<FileDiffDto> {
    Ok(service::file_diff(&sessions, id, request).await?)
}

/// Up to `count` unified rows (at most 2,000) of that diff, from row `start`.
#[tauri::command]
#[specta::specta]
pub async fn get_diff_lines(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: DiffRequestDto,
    start: u32,
    count: u32,
) -> CommandResult<Vec<DiffLineDto>> {
    Ok(service::diff_lines(&sessions, id, request, start, count).await?)
}

/// Up to `count` side-by-side rows (at most 2,000) of that diff, from row `start`.
#[tauri::command]
#[specta::specta]
pub async fn get_split_diff_lines(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: DiffRequestDto,
    start: u32,
    count: u32,
) -> CommandResult<Vec<SplitLineDto>> {
    Ok(service::split_diff_lines(&sessions, id, request, start, count).await?)
}

/// The row of `layout` that shows line `line` (1-based) of `side`, or the row of the nearest
/// line shown, so the diff tab keeps its place when the options change.
#[tauri::command]
#[specta::specta]
pub async fn find_diff_row(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: DiffRequestDto,
    layout: DiffLayout,
    side: LineSideDto,
    line: u32,
) -> CommandResult<Option<u32>> {
    Ok(service::diff_row_of_line(&sessions, id, request, layout, side, line).await?)
}

/// The raw contents of blob `blob_id` (at most 32 MB), for previews such as images.
#[tauri::command]
#[specta::specta]
pub async fn get_file_contents(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    blob_id: String,
) -> CommandResult<RawBytes> {
    Ok(service::file_contents(&sessions, id, blob_id).await?)
}

/// The entry at `path` (`/`-separated) in the tree of the commit on `row`; `""` is the root
/// folder. `null` when that commit has nothing there.
#[tauri::command]
#[specta::specta]
pub async fn get_tree_entry(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    row: u32,
    path: String,
) -> CommandResult<Option<TreeEntryDto>> {
    Ok(files::tree_entry(&sessions, id, row, path).await?)
}

/// The entries of folder `tree_id` (at most 50,000), folders first.
#[tauri::command]
#[specta::specta]
pub async fn list_tree(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    tree_id: String,
) -> CommandResult<TreeListingDto> {
    Ok(files::folder(&sessions, id, tree_id).await?)
}

/// A file shown whole (every line unchanged): its kind, size and row count. Rows come from
/// `get_file_view_lines`.
#[tauri::command]
#[specta::specta]
pub async fn get_file_view(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: FileViewRequestDto,
) -> CommandResult<FileDiffDto> {
    Ok(files::file_view(&sessions, id, request).await?)
}

/// Up to `count` rows (at most 2,000) of that file, from row `start`.
#[tauri::command]
#[specta::specta]
pub async fn get_file_view_lines(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: FileViewRequestDto,
    start: u32,
    count: u32,
) -> CommandResult<Vec<DiffLineDto>> {
    Ok(files::file_view_lines(&sessions, id, request, start, count).await?)
}

/// Asks where to save blob `blob_id` (proposing `file_name`) and writes it there exactly as
/// the repository stores it. Returns the path written, or `null` when cancelled.
#[tauri::command]
#[specta::specta]
pub async fn save_file_as(
    window: WebviewWindow,
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    blob_id: String,
    file_name: String,
) -> CommandResult<Option<String>> {
    Ok(files::save_file_as(&window, &sessions, id, blob_id, file_name).await?)
}

/// The history of file or folder `path` on the branches the graph's filter shows, following
/// renames: how many commits and the file's earlier names. Commits come from
/// `get_file_history_rows`. A request for another path cancels one still being read.
#[tauri::command]
#[specta::specta]
pub async fn get_file_history(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    path: String,
) -> CommandResult<FileHistoryDto> {
    Ok(history::file_history(&sessions, id, path).await?)
}

/// Up to `count` commits (at most 500) of that history from position `start`, newest first,
/// with their graph rows.
#[tauri::command]
#[specta::specta]
pub async fn get_file_history_rows(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    path: String,
    start: u32,
    count: u32,
) -> CommandResult<Vec<FileHistoryRowDto>> {
    Ok(history::file_history_rows(&sessions, id, path, start, count).await?)
}

/// Every branch, remote branch and tag with the row of its commit.
#[tauri::command]
#[specta::specta]
pub async fn list_refs(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<Vec<RefEntry>> {
    Ok(service::refs(&sessions, id).await?)
}

/// The working tree status summary (`null` for a bare repository).
#[tauri::command]
#[specta::specta]
pub async fn get_status_summary(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<Option<StatusSummaryDto>> {
    Ok(service::status(&sessions, id).await?)
}

/// The stash list, newest first.
#[tauri::command]
#[specta::specta]
pub async fn list_stashes(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<Vec<StashDto>> {
    Ok(service::stashes(&sessions, id).await?)
}

/// Submodules of the repository containing `path`, nested recursively.
#[tauri::command]
#[specta::specta]
pub async fn list_submodules(path: String) -> CommandResult<Vec<SubmoduleDto>> {
    Ok(service::submodules(path).await?)
}
