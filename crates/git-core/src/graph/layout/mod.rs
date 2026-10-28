//! Lane layout: which column ("lane") each commit is drawn in and which lines connect rows.
//!
//! A lane waits for a commit (the parent of the commit above it). When that commit's row is
//! reached, every lane waiting for it converges into its node; the node's lane then waits for
//! its first parent, and further parents (merges) get a free lane or join a lane that already
//! waits for them. Lane colours are assigned when a lane starts and never change.
//!
//! Storing every row's edges would cost hundreds of megabytes for a million commits, so the
//! full pass only keeps a checkpoint of the lane state every [`BLOCK_ROWS`] rows. A block is
//! re-laid out from its checkpoint when the UI asks for it; the result is identical.
//!
//! Lines can be "lit" to highlight the history of a selected commit (see [`super::Ancestry`]):
//! a line is lit when the commit it starts from is lit. Plain layouts light nothing.

mod fast;
mod step;
#[cfg(test)]
mod tests;

use super::CommitIndex;

/// Rows per block: the unit of checkpoints and of data sent to the UI.
pub const BLOCK_ROWS: u32 = 256;

/// A line from the centre of the previous row to the centre of this row.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Edge {
    /// Lane at the previous row.
    pub from: u16,
    /// Lane at this row.
    pub to: u16,
    /// Colour id of the lane the line belongs to.
    pub color: u32,
    /// Part of the highlighted history; always false outside [`super::Ancestry`].
    pub lit: bool,
}

/// Geometry of one row.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RowGeometry {
    /// Lane of the commit's node.
    pub lane: u16,
    /// Colour id of the node.
    pub color: u32,
    /// Lines arriving from the previous row.
    pub edges: Vec<Edge>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Lane {
    awaits: u32,
    color: u32,
    /// The line in this lane carries a lit commit's line.
    lit: bool,
}

/// Lane state between two rows.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(super) struct LaneState {
    lanes: Vec<Option<Lane>>,
    /// Lines leaving the previous row: (lane at previous row, lane they continue in, lit).
    outgoing: Vec<(u16, u16, bool)>,
    next_color: u32,
}

fn awaits(lane: Option<Lane>, commit: u32) -> bool {
    lane.is_some_and(|lane| lane.awaits == commit)
}

/// Lane numbers beyond `u16::MAX` are clamped; no real history gets close.
fn lane_id(index: usize) -> u16 {
    u16::try_from(index).unwrap_or(u16::MAX)
}

/// Checkpoints of the lane state for the whole history.
#[derive(Debug, Default)]
pub struct Layout {
    checkpoints: Vec<LaneState>,
    /// Widest lane count reached, to size the graph column.
    pub max_lanes: u16,
}

impl Layout {
    /// Lays out every row of `order` (commit index per row) once, keeping checkpoints. Uses
    /// the fast stepper (no lines are drawn); see `fast.rs`.
    pub fn compute(index: &CommitIndex, order: &[u32]) -> Self {
        let mut stepper = fast::Stepper::default();
        let mut layout = Self::default();
        for (number, &commit) in order.iter().enumerate() {
            if number % BLOCK_ROWS as usize == 0 {
                layout.checkpoints.push(stepper.checkpoint());
            }
            stepper.step(commit, index.parents(commit));
            layout.max_lanes = layout.max_lanes.max(lane_id(stepper.width()));
        }
        layout
    }

    /// Approximate heap memory of the checkpoints, in bytes.
    pub fn memory_bytes(&self) -> usize {
        self.checkpoints
            .iter()
            .map(|state| {
                state.lanes.capacity() * std::mem::size_of::<Option<Lane>>()
                    + state.outgoing.capacity() * std::mem::size_of::<(u16, u16, bool)>()
            })
            .sum::<usize>()
            + self.checkpoints.capacity() * std::mem::size_of::<LaneState>()
    }

    /// The lane state at the start of `block` (nothing lit).
    pub(super) fn checkpoint(&self, block: u32) -> Option<&LaneState> {
        self.checkpoints.get(block as usize)
    }

    /// Number of blocks.
    pub fn block_count(&self) -> u32 {
        u32::try_from(self.checkpoints.len()).unwrap_or(u32::MAX)
    }

    /// Re-lays out rows of `block` from its checkpoint. Empty for blocks past the end.
    pub fn block(&self, index: &CommitIndex, order: &[u32], block: u32) -> Vec<RowGeometry> {
        let Some(checkpoint) = self.checkpoints.get(block as usize) else {
            return Vec::new();
        };
        let mut state = checkpoint.clone();
        let start = block as usize * BLOCK_ROWS as usize;
        let end = (start + BLOCK_ROWS as usize).min(order.len());
        order[start..end]
            .iter()
            .map(|&commit| {
                let mut row = RowGeometry::default();
                state.step(commit, index.parents(commit), false, &mut row);
                row
            })
            .collect()
    }
}
