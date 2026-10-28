//! A compact, immutable index of every commit reachable from the tips.
//!
//! Commits get dense `u32` indices in breadth-first discovery order. Parents are stored in one
//! flat array (CSR layout), times in another, so a million commits take about 40 bytes each.
//! The commit-graph file answers most lookups without decompressing objects; commits newer
//! than the file are read from the object database. An earlier index (the previous build, or
//! the on-disk cache) can stand in for both: then only commits it lacks are read
//! ([`CommitIndex::build_from`]).

mod builder;
mod file;
#[cfg(test)]
mod testing;

use std::sync::OnceLock;

use gix::ObjectId;

use super::GraphError;
use builder::Builder;
pub use file::IndexFileError;

/// The commit DAG in compact form.
#[derive(Debug, Default)]
pub struct CommitIndex {
    ids: Vec<ObjectId>,
    times: Vec<i64>,
    parent_start: Vec<u32>,
    parents: Vec<u32>,
    /// Edges dropped because the parent object is not available (partial clones, corruption).
    pub missing_parents: usize,
    /// Commit indices sorted by id, for [`lookup`](Self::lookup); built on first use.
    by_id: OnceLock<Vec<u32>>,
}

impl CommitIndex {
    /// Number of commits.
    pub fn len(&self) -> usize {
        self.ids.len()
    }

    /// True when there are no commits (empty repository).
    pub fn is_empty(&self) -> bool {
        self.ids.is_empty()
    }

    /// Object id of commit `idx`.
    pub fn id(&self, idx: u32) -> &ObjectId {
        &self.ids[idx as usize]
    }

    /// Committer time of commit `idx`, in seconds since the epoch.
    pub fn time(&self, idx: u32) -> i64 {
        self.times[idx as usize]
    }

    /// Parent indices of commit `idx`, first parent first.
    pub fn parents(&self, idx: u32) -> &[u32] {
        let start = self.parent_start[idx as usize] as usize;
        let end = self.parent_start[idx as usize + 1] as usize;
        &self.parents[start..end]
    }

    /// Approximate heap memory, in bytes (ids, times, parents and the sorted ids if built).
    pub fn memory_bytes(&self) -> usize {
        self.ids.capacity() * std::mem::size_of::<ObjectId>()
            + self.times.capacity() * 8
            + (self.parent_start.capacity() + self.parents.capacity()) * 4
            + self.by_id.get().map_or(0, |by_id| by_id.capacity() * 4)
    }

    /// The index of the commit with `id`. The first call sorts the ids (about 0.1 s for a
    /// million commits); later calls are binary searches.
    pub fn lookup(&self, id: &gix::oid) -> Option<u32> {
        let by_id = self.by_id.get_or_init(|| {
            let mut order: Vec<u32> = (0..to_u32(self.ids.len())).collect();
            order.sort_unstable_by(|&a, &b| self.ids[a as usize].cmp(&self.ids[b as usize]));
            order
        });
        by_id
            .binary_search_by(|&idx| self.ids[idx as usize].as_ref().cmp(id))
            .ok()
            .map(|position| by_id[position])
    }

    /// Builds the index of all commits reachable from `tips`. Returns the index of each tip,
    /// or `None` for tips that are not commits (tags on trees or blobs, missing objects).
    pub fn build(
        repo: &gix::Repository,
        tips: &[ObjectId],
    ) -> Result<(Self, Vec<Option<u32>>), GraphError> {
        Self::build_from(repo, tips, None)
    }

    /// Like [`build`](Self::build), but commits found in `base` are copied from it instead of
    /// being read again. Commits of `base` that the tips no longer reach are left out, so a
    /// deleted branch or rewritten history disappears.
    ///
    /// `base` must come from the same repository with complete history: callers do not pass
    /// one for shallow or partial clones (see [`CommitIndex::reusable`]).
    pub fn build_from(
        repo: &gix::Repository,
        tips: &[ObjectId],
        base: Option<&CommitIndex>,
    ) -> Result<(Self, Vec<Option<u32>>), GraphError> {
        let mut builder = Builder::new(repo, base)?;
        let tip_indices = tips.iter().map(|id| builder.intern_tip(*id)).collect();
        builder.process_all()?;
        Ok((builder.finish(), tip_indices))
    }

    /// Whether an index of `repo` may serve as `base` for the next build: not for shallow
    /// clones (deepening adds parents to known commits) or when parents were missing (a partial
    /// clone may fetch them later).
    pub fn reusable(&self, repo: &gix::Repository) -> bool {
        // An unreadable shallow file counts as shallow: reusing would be the riskier mistake.
        self.missing_parents == 0 && repo.is_shallow().is_ok_and(|shallow| !shallow)
    }
}

/// Commit counts fit in `u32` (Git itself limits commit-graph positions to 31 bits).
fn to_u32(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}
