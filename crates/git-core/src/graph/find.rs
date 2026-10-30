//! Finding commits in the graph a tab shows (the find bar), and resolving a revision for "go to
//! commit".

use std::cmp::Ordering;

use gix::ObjectId;
use tokio_util::sync::CancellationToken;

use super::text::{needle, scan};
use super::{Graph, GraphError};

/// Shortest hex text compared with commit ids (git's shortest abbreviation).
const MIN_ID_PREFIX: usize = 4;

impl Graph {
    /// The rows whose commit matches `query`, ignoring case, in ascending order: the id starts
    /// with it (at least 4 hex digits), a branch or tag name on the commit contains it, or the
    /// author's name or e-mail or the message contains it. Commit objects are read on several
    /// threads; stops with [`GraphError::Cancelled`] once `cancel` is cancelled.
    pub fn find_rows(
        &self,
        repo: &gix::ThreadSafeRepository,
        query: &str,
        cancel: &CancellationToken,
    ) -> Result<Vec<u32>, GraphError> {
        let Some(needle) = needle(Some(query)) else {
            return Ok(Vec::new());
        };
        let query = query.trim();
        let len = self.index.len();
        let mut found = vec![false; len];
        if query.len() >= MIN_ID_PREFIX
            && let Ok(prefix) = gix::hash::Prefix::from_hex(&query.to_ascii_lowercase())
        {
            for (commit, found) in found.iter_mut().enumerate() {
                *found = prefix.cmp_oid(self.index.id(to_u32(commit))) == Ordering::Equal;
            }
        }
        let mut buffer = Vec::new();
        for (&commit, numbers) in &self.refs_by_commit {
            let named = numbers.iter().any(|&number| {
                needle.found_in(self.refs[number as usize].name.as_bytes(), &mut buffer)
            });
            found[commit as usize] |= named;
        }
        let unread: Vec<bool> = found.iter().map(|found| !found).collect();
        let by_text = scan(repo, &self.index, &unread, cancel, |commit, buffer| {
            needle.found_in_author(commit, buffer) || needle.found_in_message(commit, buffer)
        })?;
        for commit in by_text {
            found[commit] = true;
        }
        let mut rows: Vec<u32> = found
            .iter()
            .enumerate()
            .filter(|(_, found)| **found)
            .map(|(commit, _)| self.rows_of[commit])
            .collect();
        rows.sort_unstable();
        Ok(rows)
    }

    /// Where the commit `id` is: its row in this graph, or whether the full history has it.
    pub fn locate(&self, id: &gix::oid) -> Located {
        let full = self.full();
        match full.index.lookup(id) {
            None => Located::NotInGraph,
            Some(commit) => match self.shown_row(full.rows_of[commit as usize]) {
                Some(row) => Located::Shown(row),
                None => Located::Hidden,
            },
        }
    }
}

/// Where a commit is in a graph.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Located {
    /// On this row.
    Shown(u32),
    /// In the history, but the tab's filter hides it.
    Hidden,
    /// Not reachable from any branch, tag or HEAD.
    NotInGraph,
}

/// The commit a revision names: a full or abbreviated id, a branch, tag or remote branch name,
/// `HEAD~2`, `main^2`, ... (git's revision syntax, read by gix). Tags are peeled.
pub fn resolve_commit(repo: &gix::Repository, revision: &str) -> Result<ObjectId, GraphError> {
    let not_found = || GraphError::UnknownRevision(revision.trim().to_owned());
    let id = repo
        .rev_parse_single(revision.trim())
        .map_err(|_| not_found())?;
    let commit = id
        .object()
        .map_err(GraphError::gix)?
        .peel_to_commit()
        .map_err(|_| not_found())?;
    Ok(commit.id)
}

fn to_u32(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}
