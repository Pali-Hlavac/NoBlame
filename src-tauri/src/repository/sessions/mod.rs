//! Open repositories ("sessions") and their lazily built graphs (`graph.rs`).

mod graph;

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

use git_core::diff::{DiffAttribute, DiffOptions, FileDiff, diff_attribute, file_diff};
use git_core::graph::{Ancestry, Graph, GraphError};
use git_core::repo::Repository;
use git_core::watch::RepoWatcher;
use tokio_util::sync::CancellationToken;

use super::diff_cache::{DiffCache, DiffKey};
use super::graph_cache::GraphCache;
use super::service::blocking;
use super::{RepoId, RepositoryError};
use graph::GraphSlot;

/// One open repository. The graph is built on first use and kept until reloaded.
pub struct Session {
    /// The repository handle.
    pub repo: Repository,
    graph: tokio::sync::Mutex<GraphSlot>,
    /// Stops the filter being computed when a newer one is asked for.
    filter_cancel: Mutex<CancellationToken>,
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
            filter_cancel: Mutex::default(),
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
