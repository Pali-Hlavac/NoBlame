//! The history of one path (the history tab), kept while it is shown and read page by page.

use std::sync::{Arc, PoisonError};

use git_core::cli::Git;
use git_core::graph::{Graph, GraphFilter};
use git_core::history::{FileHistory, file_history};
use tokio_util::sync::CancellationToken;

use super::Session;
use crate::git_env::GitEnvError;
use crate::repository::RepositoryError;

/// A path's history, for the full graph and the branches it was read from.
pub struct PathHistory {
    /// The path asked for.
    pub path: String,
    /// The commits, ordered as in the graph (newest first).
    pub history: FileHistory,
    full: Arc<Graph>,
    filter: GraphFilter,
}

impl PathHistory {
    fn answers(&self, path: &str, full: &Arc<Graph>, filter: &GraphFilter) -> bool {
        self.path == path
            && Arc::ptr_eq(&self.full, full)
            && self.filter.tips == filter.tips
            && self.filter.first_parent == filter.first_parent
    }
}

impl Session {
    /// The history of `path` on the branches the tab's filter shows (first parents only if it
    /// says so), following renames. Kept until the history is reloaded or another path is
    /// asked for; asking for another path cancels one still being read.
    pub async fn path_history(&self, path: &str) -> Result<Arc<PathHistory>, RepositoryError> {
        let cancel = {
            let mut current = self
                .history_cancel
                .lock()
                .unwrap_or_else(PoisonError::into_inner);
            if current.0 != path {
                current.1.cancel();
                *current = (path.to_owned(), CancellationToken::new());
            }
            current.1.clone()
        };
        let mut slot = self.history.lock().await;
        let (full, filter) = self.full_graph().await?;
        if let Some(cached) = slot
            .as_ref()
            .filter(|cached| cached.answers(path, &full, &filter))
        {
            return Ok(Arc::clone(cached));
        }
        let git = Git::locate().map_err(GitEnvError::from)?;
        let info = self.repo.info();
        let dir = info.work_dir.as_ref().unwrap_or(&info.git_dir);
        let tips = full.tip_ids(&filter.tips);
        let repo = self.repo.thread_safe();
        let mut history = file_history(
            &git,
            dir,
            &repo,
            &tips,
            filter.first_parent,
            path.into(),
            &cancel,
        )
        .await?;
        // Each name's commits came in `git log` order; the graph's order interleaves them.
        history
            .entries
            .sort_by_key(|entry| full.lookup_row(&entry.id).unwrap_or(u32::MAX));
        tracing::info!(
            path,
            commits = history.entries.len(),
            names = history.paths.len(),
            "file history read"
        );
        let found = Arc::new(PathHistory {
            path: path.to_owned(),
            history,
            full,
            filter,
        });
        *slot = Some(Arc::clone(&found));
        Ok(found)
    }
}
