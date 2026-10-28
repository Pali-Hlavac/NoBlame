//! The row-by-row step: lays out one row with its lines (used for blocks and highlights).

use super::{Edge, Lane, LaneState, RowGeometry, awaits, lane_id};

impl LaneState {
    /// Lays out the row of `commit`; `lit` lights the lines leaving it.
    pub(in crate::graph) fn step(
        &mut self,
        commit: u32,
        parents: &[u32],
        lit: bool,
        row: &mut RowGeometry,
    ) {
        let node = match self.lanes.iter().position(|lane| awaits(*lane, commit)) {
            Some(lane) => lane,
            None => self.allocate(commit, false),
        };
        let color = self.lanes[node].map_or(0, |lane| lane.color);
        row.lane = lane_id(node);
        row.color = color;
        row.edges.clear();
        for &(from, lane, edge_lit) in &self.outgoing {
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
                    lit: edge_lit,
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
        let mut joined: Vec<usize> = Vec::new();
        let mut merge_edges: Vec<(u16, u16, bool)> = Vec::new();
        if let Some((&first, rest)) = parents.split_first() {
            self.lanes[node] = Some(Lane {
                awaits: first,
                color,
                lit,
            });
            for &parent in rest {
                let target = if let Some(existing) =
                    self.lanes.iter().position(|lane| awaits(*lane, parent))
                {
                    joined.push(existing);
                    existing
                } else {
                    let created = self.allocate(parent, lit);
                    merge_lanes.push(created);
                    created
                };
                merge_edges.push((lane_id(node), lane_id(target), lit));
            }
        }
        // Straight lines first, then the lines leaving a merge; the order is stable for tests.
        for (index, lane) in self.lanes.iter().enumerate() {
            if let Some(lane) = lane
                && !merge_lanes.contains(&index)
            {
                self.outgoing
                    .push((lane_id(index), lane_id(index), lane.lit));
            }
        }
        self.outgoing.extend(merge_edges);
        // A lane joined by a lit merge line is lit below the join, not above it.
        if lit {
            for index in joined {
                if let Some(lane) = self.lanes[index].as_mut() {
                    lane.lit = true;
                }
            }
        }
        while matches!(self.lanes.last(), Some(None)) {
            self.lanes.pop();
        }
    }

    /// Puts a new lane waiting for `commit` into the first free slot.
    fn allocate(&mut self, commit: u32, lit: bool) -> usize {
        let lane = Some(Lane {
            awaits: commit,
            color: self.next_color,
            lit,
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
