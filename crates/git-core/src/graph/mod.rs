//! The commit graph: refs, commit index, row order, lane layout and binary blocks for the UI.
//! See `docs/architecture/commit-graph.md`.

mod commit_details;
mod contains;
mod details;
mod encode;
mod error;
mod index;
mod layout;
mod order;
mod refs;

use std::collections::HashMap;
use std::time::{Duration, Instant};

pub use commit_details::{
    CommitDetails, MAX_CONTAINING_REFS, ParentInfo, Signature, commit_details,
};
pub use details::{CommitRow, MAX_ROWS_PER_PAGE, commit_rows};
pub use encode::{BLOCK_FORMAT_VERSION, FLAG_HEAD, FLAG_MERGE, encode_block};
pub use error::GraphError;
pub use index::CommitIndex;
pub use layout::{BLOCK_ROWS, Edge, Layout, RowGeometry};
pub use order::{date_order, rows_of};
pub use refs::{GraphRef, RefKind, collect_refs};

/// How long each build phase took, for logs and `docs/development/performance.md`.
#[derive(Debug, Clone, Copy, Default)]
pub struct BuildTimings {
    /// Reading and peeling references.
    pub refs: Duration,
    /// Walking the history into the commit index.
    pub index: Duration,
    /// Sorting rows.
    pub order: Duration,
    /// Lane layout pass.
    pub layout: Duration,
}

impl BuildTimings {
    /// Sum of all phases.
    pub fn total(&self) -> Duration {
        self.refs + self.index + self.order + self.layout
    }
}

/// Everything needed to draw the graph of one repository.
#[derive(Debug)]
pub struct Graph {
    index: CommitIndex,
    order: Vec<u32>,
    rows_of: Vec<u32>,
    layout: Layout,
    refs: Vec<GraphRef>,
    refs_by_commit: HashMap<u32, Vec<u32>>,
    head_commit: Option<u32>,
    /// Phase timings of [`Graph::build`].
    pub timings: BuildTimings,
}

impl Graph {
    /// Reads refs and history and lays out every row. CPU and I/O heavy: call it off the UI
    /// and async threads (`spawn_blocking`).
    pub fn build(repo: &gix::Repository) -> Result<Self, GraphError> {
        let started = Instant::now();
        let refs = collect_refs(repo)?;
        let head_id = repo.head_id().ok().map(gix::Id::detach);
        let mut tips: Vec<_> = refs.iter().map(|reference| reference.target).collect();
        tips.extend(head_id);
        let refs_done = Instant::now();

        let (index, tip_indices) = CommitIndex::build(repo, &tips)?;
        let index_done = Instant::now();
        let order = date_order(&index);
        let rows_of = rows_of(&order);
        let order_done = Instant::now();
        let layout = Layout::compute(&index, &order);
        let layout_done = Instant::now();

        let mut refs_by_commit: HashMap<u32, Vec<u32>> = HashMap::new();
        for (ref_number, tip) in tip_indices.iter().take(refs.len()).enumerate() {
            if let Some(commit) = tip {
                refs_by_commit
                    .entry(*commit)
                    .or_default()
                    .push(u32::try_from(ref_number).unwrap_or(u32::MAX));
            }
        }
        let head_commit = head_id.and(tip_indices.last().copied().flatten());
        Ok(Self {
            index,
            order,
            rows_of,
            layout,
            refs,
            refs_by_commit,
            head_commit,
            timings: BuildTimings {
                refs: refs_done - started,
                index: index_done - refs_done,
                order: order_done - index_done,
                layout: layout_done - order_done,
            },
        })
    }

    /// Number of rows (commits).
    pub fn row_count(&self) -> u32 {
        u32::try_from(self.order.len()).unwrap_or(u32::MAX)
    }

    /// Widest lane count, to size the graph column.
    pub fn max_lanes(&self) -> u16 {
        self.layout.max_lanes
    }

    /// Number of [`BLOCK_ROWS`]-row blocks.
    pub fn block_count(&self) -> u32 {
        self.layout.block_count()
    }

    /// Row of the commit HEAD points to.
    pub fn head_row(&self) -> Option<u32> {
        self.head_commit.map(|commit| self.rows_of[commit as usize])
    }

    /// The commit index shown on `row`.
    pub fn commit_at(&self, row: u32) -> Option<u32> {
        self.order.get(row as usize).copied()
    }

    /// Edges dropped because parent objects are missing (partial clones).
    pub fn missing_parents(&self) -> usize {
        self.index.missing_parents
    }

    /// The compact commit index.
    pub fn index(&self) -> &CommitIndex {
        &self.index
    }

    /// References pointing at `commit`, branches before tags.
    pub fn refs_of(&self, commit: u32) -> impl Iterator<Item = &GraphRef> {
        self.refs_by_commit
            .get(&commit)
            .into_iter()
            .flatten()
            .map(|&number| &self.refs[number as usize])
    }

    /// Geometry of the rows in `block`.
    pub fn block(&self, block: u32) -> Vec<RowGeometry> {
        self.layout.block(&self.index, &self.order, block)
    }

    /// The binary encoding of `block` (see [`encode_block`]).
    pub fn encode_block(&self, block: u32) -> Vec<u8> {
        let rows = self.block(block);
        let first_row = block.saturating_mul(BLOCK_ROWS);
        encode_block(first_row, &rows, |offset| {
            let row = first_row + offset;
            let commit = self.order[row as usize];
            let mut flags = 0;
            if self.index.parents(commit).len() > 1 {
                flags |= FLAG_MERGE;
            }
            if Some(commit) == self.head_commit {
                flags |= FLAG_HEAD;
            }
            flags
        })
    }
}

#[cfg(test)]
mod tests;
