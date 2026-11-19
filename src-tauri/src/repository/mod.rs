//! Open repositories, their commit graphs and the recent-repositories list.
//! See `docs/architecture/commit-graph.md` and `docs/features/repositories.md`.

mod branch_error;
mod bytes;
pub mod commands;
mod diff_cache;
mod error;
mod filter_types;
mod find;
pub mod folder;
mod graph_cache;
mod graph_types;
mod groups;
mod recent;
mod saved_filters;
mod service;
mod sessions;
mod staging_error;
mod types;
mod watch;

pub use bytes::RawBytes;
pub use diff_cache::{DiffKey, DiffKind};
pub use error::RepositoryError;
pub use filter_types::GraphFilterDto;
pub use graph_types::{
    CommitRowDto, FoundCommit, GoToCommit, GoToStatus, GraphSummary, RefLabel, ReloadedGraph,
};
pub(crate) use recent::same_path;
pub(crate) use service::blocking;
pub use sessions::RepoSessions;
pub use types::{PathScopeDto, RepoId, RepoSummary};
pub use watch::RepositoryChanged;

use tauri::{App, Manager};

use groups::{GROUPS_FILE_NAME, GroupsStore};
use recent::{RECENT_FILE_NAME, RecentStore};
use saved_filters::{FILTERS_FILE_NAME, FiltersStore};

/// Registers the session registry, the recent-repositories store and the groups store.
pub fn init(app: &App) -> tauri::Result<()> {
    let config = crate::storage::profile::config_dir(app)?;
    app.manage(RecentStore::new(config.join(RECENT_FILE_NAME)));
    app.manage(GroupsStore::new(config.join(GROUPS_FILE_NAME)));
    app.manage(FiltersStore::new(config.join(FILTERS_FILE_NAME)));
    let cache = graph_cache::GraphCache::new(crate::storage::profile::cache_dir(app));
    cache.prune(graph_cache::MAX_AGE);
    app.manage(RepoSessions::new(cache));
    Ok(())
}
