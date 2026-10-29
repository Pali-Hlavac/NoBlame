//! Repository operations behind the Tauri commands.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use git_core::cli::Git;
use git_core::graph::{BLOCK_ROWS, Graph, commit_rows};
use git_core::repo::Repository;
use tokio_util::sync::CancellationToken;

use super::recent::{self, RecentStore};
use super::sessions::Session;
use super::{
    CommitRowDto, GraphFilterDto, GraphSummary, RawBytes, ReloadedGraph, RepoId, RepoSessions,
    RepoSummary, RepositoryError, watch,
};
use crate::git_env::GitEnvError;

/// Opens the repository containing `path` and records it as recently opened.
pub async fn open(
    app: &tauri::AppHandle,
    sessions: &RepoSessions,
    recent: &RecentStore,
    path: String,
) -> Result<RepoSummary, RepositoryError> {
    let repo = blocking(move || Repository::discover(&PathBuf::from(path))).await??;
    let (id, session) = sessions.insert(repo);
    let summary = RepoSummary::new(id, session.repo.info());
    // Watching a huge tree takes a while on Linux (one inotify watch per folder): not awaited.
    let app = app.clone();
    let watched = std::sync::Arc::clone(&session);
    tokio::task::spawn_blocking(move || {
        watched.set_watcher(watch::start(&app, id, &watched.repo));
    });
    // A full disk or read-only config folder must not stop the repository from opening.
    if let Err(error) = recent::record(recent, &summary) {
        tracing::warn!(%error, "could not update the recent repositories list");
    }
    Ok(summary)
}

/// Runs `git init` in `path`, creating the folder if needed. The caller opens it afterwards.
pub async fn init(path: String) -> Result<(), RepositoryError> {
    let git = Git::locate().map_err(GitEnvError::from)?;
    git.command()
        .args(["init", "--quiet"])
        .paths([&path])
        .run(&CancellationToken::new())
        .await
        .map_err(GitEnvError::from)?;
    Ok(())
}

/// Builds (or returns the cached) graph and describes it.
pub async fn load_graph(
    sessions: &RepoSessions,
    id: RepoId,
    reload: bool,
) -> Result<GraphSummary, RepositoryError> {
    let session = sessions.get(id)?;
    let graph = session.graph(reload).await?;
    Ok(summary_of(&session, &graph).await)
}

/// Rebuilds the graph after the repository changed, and finds the commit that was on `row`.
pub async fn reload_graph(
    sessions: &RepoSessions,
    id: RepoId,
    row: Option<u32>,
) -> Result<ReloadedGraph, RepositoryError> {
    let session = sessions.get(id)?;
    let previous = session.loaded_graph().await;
    let graph = session.graph(true).await?;
    reselect(&session, previous, graph, row).await
}

/// Shows `filter` in the tab and finds the commit that was on `row`.
pub async fn set_graph_filter(
    sessions: &RepoSessions,
    id: RepoId,
    filter: GraphFilterDto,
    row: Option<u32>,
) -> Result<ReloadedGraph, RepositoryError> {
    let session = sessions.get(id)?;
    let previous = session.loaded_graph().await;
    let graph = session.set_filter(filter.into()).await?;
    reselect(&session, previous, graph, row).await
}

/// The summary of the new `graph`, with the row of the commit that was on `row` of `previous`.
async fn reselect(
    session: &Session,
    previous: Option<Arc<Graph>>,
    graph: Arc<Graph>,
    row: Option<u32>,
) -> Result<ReloadedGraph, RepositoryError> {
    let selected = previous.zip(row).and_then(|(graph, row)| graph.id_at(row));
    let row = selected.and_then(|commit| graph.row_of_id(&commit));
    Ok(ReloadedGraph {
        summary: summary_of(session, &graph).await,
        row,
    })
}

/// Re-reads HEAD and the other repository facts (after a commit, checkout, ...).
pub async fn refresh(sessions: &RepoSessions, id: RepoId) -> Result<RepoSummary, RepositoryError> {
    let mut repo = sessions.get(id)?.repo.clone();
    blocking(move || {
        repo.refresh_info()?;
        Ok::<_, RepositoryError>(RepoSummary::new(id, repo.info()))
    })
    .await?
}

async fn summary_of(session: &Session, graph: &Graph) -> GraphSummary {
    GraphSummary {
        rows: graph.row_count(),
        total_rows: graph.full().row_count(),
        filter: GraphFilterDto::from(&session.filter().await),
        max_lanes: u32::from(graph.max_lanes()),
        block_rows: BLOCK_ROWS,
        head_row: graph.head_row(),
        missing_parents: u32::try_from(graph.missing_parents()).unwrap_or(u32::MAX),
        build_ms: millis(graph.timings.total()),
        generation: session.generation(),
    }
}

/// One encoded block of rows.
pub async fn graph_block(
    sessions: &RepoSessions,
    id: RepoId,
    block: u32,
) -> Result<RawBytes, RepositoryError> {
    let graph = sessions.get(id)?.graph(false).await?;
    Ok(RawBytes(graph.encode_block(block)))
}

/// The highlight overlay of `block` for the history of the commit on `row`.
pub async fn ancestry_block(
    sessions: &RepoSessions,
    id: RepoId,
    row: u32,
    block: u32,
) -> Result<RawBytes, RepositoryError> {
    let session = sessions.get(id)?;
    let graph = session.graph(false).await?;
    let bytes = blocking(move || session.ancestry_block(&graph, row, block)).await??;
    Ok(RawBytes(bytes))
}

/// Text columns for rows `start..start + count`.
pub async fn rows(
    sessions: &RepoSessions,
    id: RepoId,
    start: u32,
    count: u32,
) -> Result<Vec<CommitRowDto>, RepositoryError> {
    let session = sessions.get(id)?;
    let graph = session.graph(false).await?;
    let repo = session.repo.clone();
    let rows = blocking(move || commit_rows(&repo.local(), &graph, start, count)).await??;
    Ok(rows.into_iter().map(CommitRowDto::from).collect())
}

/// Writes the commit-graph file with `git commit-graph write`, then reloads the summary.
pub async fn write_commit_graph(
    sessions: &RepoSessions,
    id: RepoId,
) -> Result<RepoSummary, RepositoryError> {
    let session = sessions.get(id)?;
    let git_dir = session.repo.info().git_dir.clone();
    let git = Git::locate().map_err(GitEnvError::from)?;
    git.command()
        .current_dir(git_dir)
        .args(["commit-graph", "write", "--reachable", "--changed-paths"])
        .run(&CancellationToken::new())
        .await
        .map_err(GitEnvError::from)?;
    let mut repo = session.repo.clone();
    blocking(move || {
        repo.refresh_info()?;
        Ok::<_, RepositoryError>(RepoSummary::new(id, repo.info()))
    })
    .await?
}

/// Runs `work` on Tokio's blocking pool (gix reads are synchronous and can be slow).
pub(crate) async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> T + Send + 'static,
) -> Result<T, RepositoryError> {
    tokio::task::spawn_blocking(work)
        .await
        .map_err(|error| RepositoryError::Task(error.to_string()))
}

fn millis(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1000.0
}
