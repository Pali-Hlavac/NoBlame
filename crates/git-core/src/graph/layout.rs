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

#[derive(Debug, Clone, Copy)]
struct Lane {
    awaits: u32,
    color: u32,
}

/// Lane state between two rows.
#[derive(Debug, Clone, Default)]
struct LaneState {
    lanes: Vec<Option<Lane>>,
    /// Lines leaving the previous row: (lane at previous row, lane they continue in).
    outgoing: Vec<(u16, u16)>,
    next_color: u32,
}

impl LaneState {
    fn step(&mut self, commit: u32, parents: &[u32], row: &mut RowGeometry) {
        let node = match self.lanes.iter().position(|lane| awaits(*lane, commit)) {
            Some(lane) => lane,
            None => self.allocate(commit),
        };
        let color = self.lanes[node].map_or(0, |lane| lane.color);
        row.lane = lane_id(node);
        row.color = color;
        row.edges.clear();
        for &(from, lane) in &self.outgoing {
            if let Some(state) = self.lanes[usize::from(lane)] {
                let to = if state.awaits == commit {
                    lane_id(node)
                } else {
                    lane
                };
                row.edges.push(Edge {
                    from,
                    to,
                    color: state.color,
                });
            }
        }
        for lane in &mut self.lanes {
            if awaits(*lane, commit) {
                *lane = None;
            }
        }
        self.outgoing.clear();
        let mut merge_lanes: Vec<usize> = Vec::new();
        let mut merge_edges: Vec<(u16, u16)> = Vec::new();
        if let Some((&first, rest)) = parents.split_first() {
            self.lanes[node] = Some(Lane {
                awaits: first,
                color,
            });
            for &parent in rest {
                let target = if let Some(existing) =
                    self.lanes.iter().position(|lane| awaits(*lane, parent))
                {
                    existing
                } else {
                    let created = self.allocate(parent);
                    merge_lanes.push(created);
                    created
                };
                merge_edges.push((lane_id(node), lane_id(target)));
            }
        }
        // Straight lines first, then the lines leaving a merge; the order is stable for tests.
        for (index, lane) in self.lanes.iter().enumerate() {
            if lane.is_some() && !merge_lanes.contains(&index) {
                self.outgoing.push((lane_id(index), lane_id(index)));
            }
        }
        self.outgoing.extend(merge_edges);
        while matches!(self.lanes.last(), Some(None)) {
            self.lanes.pop();
        }
    }

    /// Puts a new lane waiting for `commit` into the first free slot.
    fn allocate(&mut self, commit: u32) -> usize {
        let lane = Some(Lane {
            awaits: commit,
            color: self.next_color,
        });
        self.next_color = self.next_color.wrapping_add(1);
        if let Some(free) = self.lanes.iter().position(Option::is_none) {
            self.lanes[free] = lane;
            free
        } else {
            self.lanes.push(lane);
            self.lanes.len() - 1
        }
    }
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
    /// Lays out every row of `order` (commit index per row) once, keeping checkpoints.
    pub fn compute(index: &CommitIndex, order: &[u32]) -> Self {
        let mut state = LaneState::default();
        let mut layout = Self::default();
        let mut row = RowGeometry::default();
        for (number, &commit) in order.iter().enumerate() {
            if number % BLOCK_ROWS as usize == 0 {
                layout.checkpoints.push(state.clone());
            }
            state.step(commit, index.parents(commit), &mut row);
            layout.max_lanes = layout.max_lanes.max(lane_id(state.lanes.len()));
        }
        layout
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
                state.step(commit, index.parents(commit), &mut row);
                row
            })
            .collect()
    }
}
