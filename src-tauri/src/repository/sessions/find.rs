//! The find bar's search: the matching rows of the graph a tab shows, kept for the last query
//! so "next" and "previous" do not search again.

use std::sync::{Arc, PoisonError};

use git_core::graph::Graph;
use tokio_util::sync::CancellationToken;

use super::Session;
use crate::repository::{RepositoryError, blocking};

/// The rows found for one query in one graph.
pub(super) struct FoundRows {
    graph: Arc<Graph>,
    query: String,
    rows: Arc<Vec<u32>>,
}

impl Session {
    /// The rows matching `query` in the shown graph, ascending. Searches once per query and
    /// graph; a newer search cancels one still running.
    pub async fn find_rows(&self, query: String) -> Result<Arc<Vec<u32>>, RepositoryError> {
        let graph = self.graph(false).await?;
        {
            let found = self.found.lock().unwrap_or_else(PoisonError::into_inner);
            if let Some(found) = found
                .as_ref()
                .filter(|found| Arc::ptr_eq(&found.graph, &graph) && found.query == query)
            {
                return Ok(Arc::clone(&found.rows));
            }
        }
        let cancel = {
            let mut current = self
                .find_cancel
                .lock()
                .unwrap_or_else(PoisonError::into_inner);
            current.cancel();
            *current = CancellationToken::new();
            current.clone()
        };
        let (searched, wanted, repo) = (Arc::clone(&graph), query.clone(), self.repo.thread_safe());
        let rows = blocking(move || searched.find_rows(&repo, &wanted, &cancel)).await??;
        let rows = Arc::new(rows);
        *self.found.lock().unwrap_or_else(PoisonError::into_inner) = Some(FoundRows {
            graph,
            query,
            rows: Arc::clone(&rows),
        });
        Ok(rows)
    }
}
