//! The full layout pass without drawing: only the lane state is advanced, so the checkpoints can
//! be taken. [`LaneState::step`] finds lanes by scanning all of them and rebuilds every outgoing
//! line per row: fine for 256 rows of a block, but on the Linux kernel (700 lanes at once) the
//! whole history took 1.5 s. Here lanes are found through a map from the awaited commit, free
//! slots through a sorted set, and the outgoing lines are only built at checkpoints. The
//! checkpoints are identical to those of the row-by-row step (tested).

use std::collections::{BTreeSet, HashMap};

use super::{Lane, LaneState, lane_id};

#[derive(Debug, Default)]
pub(super) struct Stepper {
    lanes: Vec<Option<Lane>>,
    next_color: u32,
    /// Lanes waiting for each commit.
    waiting: HashMap<u32, Vec<usize>>,
    /// Empty slots below `lanes.len()`.
    free: BTreeSet<usize>,
    /// Lanes created for merge parents by the last step, and the lines leaving the merge.
    merge_lanes: Vec<usize>,
    merge_edges: Vec<(u16, u16, bool)>,
}

impl Stepper {
    /// Number of lanes in use (including empty slots below the last one).
    pub(super) fn width(&self) -> usize {
        self.lanes.len()
    }

    /// The state [`LaneState::step`] would have reached after the same rows.
    pub(super) fn checkpoint(&self) -> LaneState {
        let mut outgoing: Vec<(u16, u16, bool)> = self
            .lanes
            .iter()
            .enumerate()
            .filter(|(index, lane)| lane.is_some() && !self.merge_lanes.contains(index))
            .map(|(index, lane)| (lane_id(index), lane_id(index), lane.is_some_and(|l| l.lit)))
            .collect();
        outgoing.extend_from_slice(&self.merge_edges);
        LaneState {
            lanes: self.lanes.clone(),
            outgoing,
            next_color: self.next_color,
        }
    }

    /// Advances past the row of `commit`; same rules as [`LaneState::step`].
    pub(super) fn step(&mut self, commit: u32, parents: &[u32]) {
        let node = match self
            .waiting
            .get(&commit)
            .and_then(|lanes| lanes.iter().min())
        {
            Some(&lane) => lane,
            None => self.allocate(commit),
        };
        let color = self.lanes[node].map_or(0, |lane| lane.color);
        for lane in self.waiting.remove(&commit).unwrap_or_default() {
            self.lanes[lane] = None;
            self.free.insert(lane);
        }
        self.merge_lanes.clear();
        self.merge_edges.clear();
        if let Some((&first, rest)) = parents.split_first() {
            self.lanes[node] = Some(Lane {
                awaits: first,
                color,
                lit: false,
            });
            self.free.remove(&node);
            self.waiting.entry(first).or_default().push(node);
            for &parent in rest {
                let existing = self
                    .waiting
                    .get(&parent)
                    .and_then(|lanes| lanes.iter().min())
                    .copied();
                let target = existing.unwrap_or_else(|| {
                    let created = self.allocate(parent);
                    self.merge_lanes.push(created);
                    created
                });
                self.merge_edges
                    .push((lane_id(node), lane_id(target), false));
            }
        }
        while matches!(self.lanes.last(), Some(None)) {
            self.lanes.pop();
            self.free.remove(&self.lanes.len());
        }
    }

    /// Puts a new lane waiting for `commit` into the first free slot.
    fn allocate(&mut self, commit: u32) -> usize {
        let lane = Some(Lane {
            awaits: commit,
            color: self.next_color,
            lit: false,
        });
        self.next_color = self.next_color.wrapping_add(1);
        let slot = if let Some(free) = self.free.pop_first() {
            self.lanes[free] = lane;
            free
        } else {
            self.lanes.push(lane);
            self.lanes.len() - 1
        };
        self.waiting.entry(commit).or_default().push(slot);
        slot
    }
}
