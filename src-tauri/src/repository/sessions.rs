//! Open repositories ("sessions") and their lazily built graphs.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

use git_core::diff::{DiffAttribute, DiffOptions, FileDiff, diff_attribute, file_diff};
use git_core::graph::{Ancestry, Graph, GraphError, GraphFilter};
use git_core::repo::Repository;
use git_core::watch::RepoWatcher;

use super::diff_cache::{DiffCache, DiffKey};
use super::graph_cache::GraphCache;
use super::service::blocking;
use super::{RepoId, RepositoryError};

/// The history of a session and what the tab's filter shows of it.
#[derive(Default)]
struct GraphSlot {
    full: Option<Arc<Graph>>,
    /// The full graph itself when nothing is filtered.
    shown: Option<Arc<Graph>>,
    filter: GraphFilter,
}

/// One open repository. The graph is built on first use and kept until reloaded.
pub struct Session {
    /// The repository handle.
    pub repo: Repository,
    graph: tokio::sync::Mutex<GraphSlot>,
    /// The highlighted history of the last selected row, for the graph it was found in.
    ancestry: Mutex<Option<(Arc<Graph>, Ancestry)>>,
    /// Graphs shown so far (builds and filter changes).
    generation: AtomicU32,
    /// Reports changes made outside the app; stops when the session is dropped.
    watcher: Mutex<Option<RepoWatcher>>,
    /// The on-disk commit indexes (ADR 0010).
    cache: Arc<GraphCache>,
    /// File diffs shown recently (ADR 0013).
    diffs: DiffCache,
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
        self.show(&mut slot, full).await
    }

    /// Shows `filter`, keeping the history already read, and returns the new view.
    pub async fn set_filter(&self, filter: GraphFilter) -> Result<Arc<Graph>, RepositoryError> {
        let mut slot = self.graph.lock().await;
        let full = match slot.full.clone() {
            Some(full) => full,
            None => self.build(None).await?,
        };
        slot.filter = filter;
        self.show(&mut slot, full).await
    }

    /// The filter of the tab.
    pub async fn filter(&self) -> GraphFilter {
        self.graph.lock().await.filter.clone()
    }

    /// Makes the view of `full` the slot's filter asks for, and makes it the shown graph.
    async fn show(
        &self,
        slot: &mut GraphSlot,
        full: Arc<Graph>,
    ) -> Result<Arc<Graph>, RepositoryError> {
        let shown = if slot.filter.is_empty() {
            Arc::clone(&full)
        } else {
            let (source, filter) = (Arc::clone(&full), slot.filter.clone());
            let view = blocking(move || source.filtered(&filter)).await?;
            tracing::info!(rows = view.row_count(), time = ?view.timings.filter, "graph filtered");
            Arc::new(view)
        };
        slot.full = Some(full);
        slot.shown = Some(Arc::clone(&shown));
        // The highlight belongs to the old graph; dropping it frees that graph now.
        *self.ancestry.lock().unwrap_or_else(PoisonError::into_inner) = None;
        self.generation.fetch_add(1, Ordering::Relaxed);
        Ok(shown)
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

    /// How many graphs have been shown (builds and filter changes).
    pub fn generation(&self) -> u32 {
        self.generation.load(Ordering::Relaxed)
    }

    /// Keeps `watcher` running for as long as the session lives.
    pub fn set_watcher(&self, watcher: Option<RepoWatcher>) {
        *self.watcher.lock().unwrap_or_else(PoisonError::into_inner) = watcher;
    }

    /// The diff a key names, computed on a blocking thread unless it was shown recently. The
    /// path's `.gitattributes` decide between text and binary (read only when computing), and
    /// its language colours the rows when `syntax` is set.
    pub async fn file_diff(&self, key: DiffKey) -> Result<Arc<FileDiff>, RepositoryError> {
        if let Some(diff) = self.diffs.get(&key) {
            return Ok(diff);
        }
        let repo = self.repo.clone();
        let DiffKey {
            old,
            new,
            path,
            options,
            syntax,
        } = key.clone();
        let diff = blocking(move || {
            let repo = repo.local();
            let attribute = match &path {
                Some(path) => diff_attribute(&repo, path.as_str().into())?,
                None => DiffAttribute::Unspecified,
            };
            let options = DiffOptions {
                attribute,
                ..options
            };
            let mut diff = file_diff(&repo, old, new, options)?;
            if let Some(path) = path.as_deref().filter(|_| syntax) {
                diff.highlight_as(path);
            }
            Ok::<_, RepositoryError>(diff)
        })
        .await??;
        let diff = Arc::new(diff);
        self.diffs.insert(key, Arc::clone(&diff));
        Ok(diff)
    }

    /// The highlight overlay of `block` for the history of `row`. Keeps the history of the last
    /// row asked for, so the blocks of one selection are found and replayed once. Blocking.
    pub fn ancestry_block(
        &self,
        graph: &Arc<Graph>,
        row: u32,
        block: u32,
    ) -> Result<Vec<u8>, RepositoryError> {
        // Every update replaces the whole value, so a poisoned lock still holds consistent data.
        let mut slot = self.ancestry.lock().unwrap_or_else(PoisonError::into_inner);
        let current = matches!(&*slot, Some((built, ancestry))
            if Arc::ptr_eq(built, graph) && ancestry.row() == row);
        if !current {
            *slot = graph
                .ancestry(row)
                .map(|ancestry| (Arc::clone(graph), ancestry));
        }
        let (_, ancestry) = slot.as_mut().ok_or(GraphError::RowOutOfRange {
            row,
            rows: graph.row_count(),
        })?;
        Ok(graph.encode_ancestry_block(ancestry, block))
    }
}

/// All open sessions, by id.
#[derive(Default)]
pub struct RepoSessions {
    inner: Mutex<Inner>,
    cache: Arc<GraphCache>,
}

#[derive(Default)]
struct Inner {
    next_id: RepoId,
    sessions: HashMap<RepoId, Arc<Session>>,
}

impl RepoSessions {
    /// No sessions yet; graphs are cached in `cache`.
    pub fn new(cache: GraphCache) -> Self {
        Self {
            inner: Mutex::default(),
            cache: Arc::new(cache),
        }
    }

    /// Registers an opened repository and returns its new id.
    pub fn insert(&self, repo: Repository) -> (RepoId, Arc<Session>) {
        let mut inner = self.lock();
        inner.next_id += 1;
        let id = inner.next_id;
        let session = Arc::new(Session {
            repo,
            graph: tokio::sync::Mutex::default(),
            ancestry: Mutex::new(None),
            generation: AtomicU32::new(0),
            watcher: Mutex::new(None),
            cache: Arc::clone(&self.cache),
            diffs: DiffCache::default(),
        });
        inner.sessions.insert(id, Arc::clone(&session));
        (id, session)
    }

    /// The session with `id`.
    pub fn get(&self, id: RepoId) -> Result<Arc<Session>, RepositoryError> {
        self.lock()
            .sessions
            .get(&id)
            .cloned()
            .ok_or(RepositoryError::UnknownSession(id))
    }

    /// Forgets a session; its memory is freed once running commands finish.
    pub fn remove(&self, id: RepoId) {
        self.lock().sessions.remove(&id);
    }

    fn lock(&self) -> MutexGuard<'_, Inner> {
        // Every update is a single statement, so a poisoned lock still holds consistent data.
        self.inner.lock().unwrap_or_else(PoisonError::into_inner)
    }
}
