//! Open repositories, their commit graphs and the recent-repositories list.
//! See `docs/architecture/commit-graph.md` and `docs/features/repositories.md`.

mod bytes;
pub mod commands;
mod error;
mod graph_cache;
mod graph_types;
mod recent;
mod service;
mod sessions;
mod types;
mod watch;

pub use bytes::GraphBytes;
pub use error::RepositoryError;
pub use graph_types::{CommitRowDto, GraphSummary, RefLabel, ReloadedGraph};
pub(crate) use service::blocking;
pub use sessions::RepoSessions;
pub use types::{RepoId, RepoSummary};
pub use watch::RepositoryChanged;

use tauri::{App, Manager};

use recent::{RECENT_FILE_NAME, RecentStore};

/// Registers the session registry and the recent-repositories store.
pub fn init(app: &App) -> tauri::Result<()> {
    let path = app.path().app_config_dir()?.join(RECENT_FILE_NAME);
    app.manage(RecentStore::new(path));
    let cache = graph_cache::GraphCache::new(app.path().app_cache_dir().ok());
    cache.prune(graph_cache::MAX_AGE);
    app.manage(RepoSessions::new(cache));
    Ok(())
}
