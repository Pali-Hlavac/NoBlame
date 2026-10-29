//! Tauri boundary for repositories and the commit graph.

use tauri::State;

use super::recent::{self, RecentRepository, RecentStore};
use super::{
    CommitRowDto, GraphFilterDto, GraphSummary, RawBytes, ReloadedGraph, RepoId, RepoSessions,
    RepoSummary, service,
};
use crate::error::CommandResult;

/// Opens the repository containing `path` (searching parent folders).
#[tauri::command]
#[specta::specta]
pub async fn open_repository(
    app: tauri::AppHandle,
    sessions: State<'_, RepoSessions>,
    recent: State<'_, RecentStore>,
    path: String,
) -> CommandResult<RepoSummary> {
    Ok(service::open(&app, &sessions, &recent, path).await?)
}

/// Re-reads HEAD and the other facts of an open repository.
#[tauri::command]
#[specta::specta]
pub async fn refresh_repository(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<RepoSummary> {
    Ok(service::refresh(&sessions, id).await?)
}

/// Rebuilds the graph after the repository changed; `row` (the selected commit) is mapped to
/// that commit's row in the new graph.
#[tauri::command]
#[specta::specta]
pub async fn reload_graph(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    row: Option<u32>,
) -> CommandResult<ReloadedGraph> {
    Ok(service::reload_graph(&sessions, id, row).await?)
}

/// Shows only the commits `filter` keeps (or all, with the default filter); `row` (the
/// selected commit) is mapped to that commit's row in the new view, if it is shown.
#[tauri::command]
#[specta::specta]
pub async fn set_graph_filter(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    filter: GraphFilterDto,
    row: Option<u32>,
) -> CommandResult<ReloadedGraph> {
    Ok(service::set_graph_filter(&sessions, id, filter, row).await?)
}

/// Creates a repository in `path` with `git init` (open it with `open_repository` next).
#[tauri::command]
#[specta::specta]
pub async fn init_repository(path: String) -> CommandResult<()> {
    Ok(service::init(path).await?)
}

/// Closes a repository session (when its tab closes).
#[tauri::command]
#[specta::specta]
pub fn close_repository(sessions: State<'_, RepoSessions>, id: RepoId) {
    sessions.remove(id);
}

/// Builds the graph (or returns the cached one; `reload` forces a rebuild).
#[tauri::command]
#[specta::specta]
pub async fn load_graph(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    reload: bool,
) -> CommandResult<GraphSummary> {
    Ok(service::load_graph(&sessions, id, reload).await?)
}

/// One block of graph rows in the binary format of `docs/architecture/ipc.md`.
#[tauri::command]
#[specta::specta]
pub async fn get_graph_block(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    block: u32,
) -> CommandResult<RawBytes> {
    Ok(service::graph_block(&sessions, id, block).await?)
}

/// Which nodes and lines of one block belong to the history of the commit on `row` (binary
/// overlay, see `docs/architecture/ipc.md`).
#[tauri::command]
#[specta::specta]
pub async fn get_ancestry_block(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    row: u32,
    block: u32,
) -> CommandResult<RawBytes> {
    Ok(service::ancestry_block(&sessions, id, row, block).await?)
}

/// Text columns (id, summary, author, date, refs) for up to 500 rows.
#[tauri::command]
#[specta::specta]
pub async fn get_commit_rows(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    start: u32,
    count: u32,
) -> CommandResult<Vec<CommitRowDto>> {
    Ok(service::rows(&sessions, id, start, count).await?)
}

/// Writes the commit-graph file (`git commit-graph write --reachable --changed-paths`).
#[tauri::command]
#[specta::specta]
pub async fn write_commit_graph(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<RepoSummary> {
    Ok(service::write_commit_graph(&sessions, id).await?)
}

/// Recently opened repositories, newest first.
#[tauri::command]
#[specta::specta]
pub async fn list_recent_repositories(
    recent: State<'_, RecentStore>,
) -> CommandResult<Vec<RecentRepository>> {
    Ok(recent::list(&recent)?)
}

/// Removes a repository from the recent list and returns the rest.
#[tauri::command]
#[specta::specta]
pub async fn remove_recent_repository(
    recent: State<'_, RecentStore>,
    path: String,
) -> CommandResult<Vec<RecentRepository>> {
    Ok(recent::remove(&recent, &path)?)
}
