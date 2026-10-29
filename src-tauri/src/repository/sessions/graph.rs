//! The graph of a session: the full history, the tab's filter and the view it shows.

use std::sync::atomic::Ordering;
use std::sync::{Arc, PoisonError};

use git_core::cli::Git;
use git_core::diff::ObjectId;
use git_core::graph::{Graph, GraphError, GraphFilter, commits_changing};
use tokio_util::sync::CancellationToken;

use super::Session;
use crate::git_env::GitEnvError;
use crate::repository::{RepositoryError, blocking};

/// The history of a session and what the tab's filter shows of it.
#[derive(Default)]
pub(super) struct GraphSlot {
    full: Option<Arc<Graph>>,
    /// The full graph itself when nothing is filtered.
    shown: Option<Arc<Graph>>,
    filter: GraphFilter,
}

impl Session {
    /// The graph the tab shows (filtered or not), building it on a blocking thread the first
    /// time or when `reload` is set. Concurrent callers wait for the same build instead of
    /// starting another; a reload keeps the filter.
    pub async fn graph(&self, reload: bool) -> Result<Arc<Graph>, RepositoryError> {
        let mut slot = self.graph.lock().await;
        if let Some(graph) = slot.shown.as_ref().filter(|_| !reload) {
            return Ok(Arc::clone(graph));
        }
        let full = self.build(slot.full.clone()).await?;
        let filter = slot.filter.clone();
        self.show(&mut slot, full, filter, CancellationToken::new())
            .await
    }

    /// Shows `filter`, keeping the history already read, and returns the new view. A newer
    /// call cancels this one ([`GraphError::Cancelled`]): searching authors and messages takes
    /// a second or two on huge histories.
    pub async fn set_filter(&self, filter: GraphFilter) -> Result<Arc<Graph>, RepositoryError> {
        let cancel = {
            let mut current = self
                .filter_cancel
                .lock()
                .unwrap_or_else(PoisonError::into_inner);
            current.cancel();
            *current = CancellationToken::new();
            current.clone()
        };
        let mut slot = self.graph.lock().await;
        if cancel.is_cancelled() {
            return Err(GraphError::Cancelled.into());
        }
        let full = match slot.full.clone() {
            Some(full) => full,
            None => self.build(None).await?,
        };
        self.show(&mut slot, full, filter, cancel).await
    }

    /// The filter of the tab.
    pub async fn filter(&self) -> GraphFilter {
        self.graph.lock().await.filter.clone()
    }

    /// Makes the view of `full` that `filter` asks for, and makes it the shown graph.
    async fn show(
        &self,
        slot: &mut GraphSlot,
        full: Arc<Graph>,
        filter: GraphFilter,
        cancel: CancellationToken,
    ) -> Result<Arc<Graph>, RepositoryError> {
        let shown = if filter.is_empty() {
            Arc::clone(&full)
        } else {
            let changing = match filter.path.as_deref() {
                Some(path) => Some(self.commits_changing(&full, &filter, path, &cancel).await?),
                None => None,
            };
            let (source, wanted, repo) =
                (Arc::clone(&full), filter.clone(), self.repo.thread_safe());
            let view =
                blocking(move || source.filtered_in(&repo, &wanted, changing.as_deref(), &cancel))
                    .await??;
            tracing::info!(rows = view.row_count(), time = ?view.timings.filter, "graph filtered");
            Arc::new(view)
        };
        slot.filter = filter;
        slot.full = Some(full);
        slot.shown = Some(Arc::clone(&shown));
        // The highlight belongs to the old graph; dropping it frees that graph now.
        *self.ancestry.lock().unwrap_or_else(PoisonError::into_inner) = None;
        self.generation.fetch_add(1, Ordering::Relaxed);
        Ok(shown)
    }

    /// The commits of `filter`'s tips that change `path`, listed by `git rev-list`.
    async fn commits_changing(
        &self,
        full: &Graph,
        filter: &GraphFilter,
        path: &str,
        cancel: &CancellationToken,
    ) -> Result<Vec<ObjectId>, RepositoryError> {
        let git = Git::locate().map_err(GitEnvError::from)?;
        let info = self.repo.info();
        let dir = info.work_dir.as_ref().unwrap_or(&info.git_dir);
        let tips = full.tip_ids(&filter.tips);
        let changing = commits_changing(&git, dir, &tips, filter.first_parent, path, cancel)
            .await
            .map_err(GitEnvError::from)?;
        Ok(changing)
    }

    /// Reads the full history on a blocking thread. Commits already known are not read again:
    /// a reload reuses the previous build, the first build the on-disk cache (ADR 0010). After
    /// each build the index is saved for next time.
    async fn build(&self, previous: Option<Arc<Graph>>) -> Result<Arc<Graph>, RepositoryError> {
        let repo = self.repo.clone();
        let cache = Arc::clone(&self.cache);
        let (graph, reused) = tokio::task::spawn_blocking(move || {
            let local = repo.local();
            let cached = previous.is_none().then(|| cache.load(&repo)).flatten();
            let base = match &previous {
                Some(graph) => Some(graph.index()).filter(|index| index.reusable(&local)),
                None => cached.as_ref(),
            };
            let reused = base.map_or(0, git_core::graph::CommitIndex::len);
            Graph::build_with(&local, base).map(|graph| (graph, reused))
        })
        .await
        .map_err(|error| RepositoryError::Task(error.to_string()))??;
        let t = graph.timings;
        tracing::info!(
            rows = graph.row_count(), reused,
            refs = ?t.refs, index = ?t.index, order = ?t.order, layout = ?t.layout,
            "graph built"
        );
        let graph = Arc::new(graph);
        self.save_index(&graph);
        Ok(graph)
    }

    /// Saves the index in the background; this also sorts its ids, which the next reload
    /// needs for looking commits up.
    fn save_index(&self, graph: &Arc<Graph>) {
        let (repo, cache, graph) = (
            self.repo.clone(),
            Arc::clone(&self.cache),
            Arc::clone(graph),
        );
        tokio::task::spawn_blocking(move || cache.store(&repo, graph.index()));
    }

    /// The graph shown if it has been built, without building it.
    pub async fn loaded_graph(&self) -> Option<Arc<Graph>> {
        self.graph.lock().await.shown.clone()
    }
}
