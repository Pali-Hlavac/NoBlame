//! Open repositories ("sessions") and their lazily built graphs.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

use git_core::graph::{Ancestry, Graph, GraphError};
use git_core::repo::Repository;
use git_core::watch::RepoWatcher;

use super::{RepoId, RepositoryError};

/// One open repository. The graph is built on first use and kept until reloaded.
pub struct Session {
    /// The repository handle.
    pub repo: Repository,
    graph: tokio::sync::Mutex<Option<Arc<Graph>>>,
    /// The highlighted history of the last selected row, for the graph it was found in.
    ancestry: Mutex<Option<(Arc<Graph>, Ancestry)>>,
    /// Builds of the graph so far.
    generation: AtomicU32,
    /// Reports changes made outside the app; stops when the session is dropped.
    watcher: Mutex<Option<RepoWatcher>>,
}

impl Session {
    /// The graph, building it on a blocking thread the first time (or when `reload` is set).
    /// Concurrent callers wait for the same build instead of starting another.
    pub async fn graph(&self, reload: bool) -> Result<Arc<Graph>, RepositoryError> {
        let mut slot = self.graph.lock().await;
        if let Some(graph) = slot.as_ref().filter(|_| !reload) {
            return Ok(Arc::clone(graph));
        }
        let repo = self.repo.clone();
        let graph = tokio::task::spawn_blocking(move || Graph::build(&repo.local()))
            .await
            .map_err(|error| RepositoryError::Task(error.to_string()))??;
        let t = graph.timings;
        tracing::info!(
            rows = graph.row_count(),
            refs = ?t.refs, index = ?t.index, order = ?t.order, layout = ?t.layout,
            "graph built"
        );
        let graph = Arc::new(graph);
        *slot = Some(Arc::clone(&graph));
        self.generation.fetch_add(1, Ordering::Relaxed);
        Ok(graph)
    }

    /// The graph if it has been built, without building it.
    pub async fn loaded_graph(&self) -> Option<Arc<Graph>> {
        self.graph.lock().await.clone()
    }

    /// How many times the graph has been built.
    pub fn generation(&self) -> u32 {
        self.generation.load(Ordering::Relaxed)
    }

    /// Keeps `watcher` running for as long as the session lives.
    pub fn set_watcher(&self, watcher: Option<RepoWatcher>) {
        *self.watcher.lock().unwrap_or_else(PoisonError::into_inner) = watcher;
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
}

#[derive(Default)]
struct Inner {
    next_id: RepoId,
    sessions: HashMap<RepoId, Arc<Session>>,
}

impl RepoSessions {
    /// Registers an opened repository and returns its new id.
    pub fn insert(&self, repo: Repository) -> (RepoId, Arc<Session>) {
        let mut inner = self.lock();
        inner.next_id += 1;
        let id = inner.next_id;
        let session = Arc::new(Session {
            repo,
            graph: tokio::sync::Mutex::new(None),
            ancestry: Mutex::new(None),
            generation: AtomicU32::new(0),
            watcher: Mutex::new(None),
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
