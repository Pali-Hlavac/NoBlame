//! Open repositories, their commit graphs and the recent-repositories list.
//! See `docs/architecture/commit-graph.md` and `docs/features/repositories.md`.

mod bytes;
pub mod commands;
mod diff_cache;
mod error;
mod filter_types;
mod find;
mod graph_cache;
mod graph_types;
mod groups;
mod recent;
mod service;
mod sessions;
mod types;
mod watch;

pub use bytes::RawBytes;
pub use diff_cache::{DiffKey, DiffKind};
pub use error::RepositoryError;
pub use filter_types::GraphFilterDto;
pub use graph_types::{
    CommitRowDto, FoundCommit, GoToCommit, GoToStatus, GraphSummary, RefLabel, ReloadedGraph,
};
pub(crate) use service::blocking;
pub use sessions::RepoSessions;
pub use types::{RepoId, RepoSummary};
pub use watch::RepositoryChanged;

use tauri::{App, Manager};

use groups::{GROUPS_FILE_NAME, GroupsStore};
use recent::{RECENT_FILE_NAME, RecentStore};

/// Registers the session registry, the recent-repositories store and the groups store.
pub fn init(app: &App) -> tauri::Result<()> {
    let config = app.path().app_config_dir()?;
    app.manage(RecentStore::new(config.join(RECENT_FILE_NAME)));
    app.manage(GroupsStore::new(config.join(GROUPS_FILE_NAME)));
    let cache = graph_cache::GraphCache::new(app.path().app_cache_dir().ok());
    cache.prune(graph_cache::MAX_AGE);
    app.manage(RepoSessions::new(cache));
    Ok(())
}
