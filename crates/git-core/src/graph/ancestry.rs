//! Highlighting the history of a selected commit: which rows are its ancestors (itself
//! included) and which lines lead into it.
//!
//! Rows are in topological order, so the ancestors all sit on or below the selected row and one
//! pass down the rows finds them. Lines are lit by replaying the lane layout from the selected
//! row's block with the ancestors lit. The lane state at each later block start is kept, so a
//! block is replayed at most once per selection, and only when the UI asks for it.

use super::Graph;
use super::encode::encode_ancestry_block;
use super::layout::{BLOCK_ROWS, LaneState, RowGeometry};

/// The highlighted history of one selected row.
#[derive(Debug)]
pub struct Ancestry {
    row: u32,
    /// `in_history[r - row]`: the commit on row `r` is the selected one or one of its ancestors.
    in_history: Vec<bool>,
    /// Lane state, with lit lines, at the start of each block from the selected row's block on.
    states: Vec<LaneState>,
}

impl Ancestry {
    /// The selected row.
    pub fn row(&self) -> u32 {
        self.row
    }

    /// Whether the commit on `row` is the selected commit or one of its ancestors.
    pub fn contains_row(&self, row: u32) -> bool {
        row.checked_sub(self.row)
            .and_then(|offset| self.in_history.get(offset as usize))
            .copied()
            .unwrap_or(false)
    }

    fn first_block(&self) -> u32 {
        self.row / BLOCK_ROWS
    }
}

impl Graph {
    /// Finds the history of the commit on `row`. Costs one pass over the rows below it.
    pub fn ancestry(&self, row: u32) -> Option<Ancestry> {
        let start = row as usize;
        if start >= self.order.len() {
            return None;
        }
        let mut in_history = vec![false; self.order.len() - start];
        in_history[0] = true;
        for offset in 0..in_history.len() {
            if !in_history[offset] {
                continue;
            }
            for &parent in self.index.parents(self.order[start + offset]) {
                let parent_row = self.rows_of[parent as usize] as usize;
                if let Some(slot) = in_history.get_mut(parent_row.wrapping_sub(start)) {
                    *slot = true;
                }
            }
        }
        let first_block = row / BLOCK_ROWS;
        let states = self
            .layout
            .checkpoint(first_block)
            .cloned()
            .into_iter()
            .collect();
        Some(Ancestry {
            row,
            in_history,
            states,
        })
    }

    /// Geometry of `block` with the lines of `ancestry` lit. Blocks above the selection have
    /// nothing lit.
    pub fn ancestry_block(&self, ancestry: &mut Ancestry, block: u32) -> Vec<RowGeometry> {
        let first = ancestry.first_block();
        if block < first || block >= self.block_count() {
            return self.block(block);
        }
        // Replay the blocks between the last known state and this block, keeping each state.
        while ancestry.states.len() <= (block - first) as usize {
            let known = first + u32::try_from(ancestry.states.len()).unwrap_or(u32::MAX) - 1;
            let Some(mut state) = ancestry.states.last().cloned() else {
                return self.block(block);
            };
            self.advance(ancestry, known, &mut state);
            ancestry.states.push(state);
        }
        let mut state = ancestry.states[(block - first) as usize].clone();
        self.replay(ancestry, block, &mut state)
    }

    /// The overlay for `block` (see [`encode_ancestry_block`]).
    pub fn encode_ancestry_block(&self, ancestry: &mut Ancestry, block: u32) -> Vec<u8> {
        let rows = self.ancestry_block(ancestry, block);
        let first_row = block.saturating_mul(BLOCK_ROWS);
        encode_ancestry_block(first_row, &rows, |row| ancestry.contains_row(row))
    }

    /// Moves `state` from the start of `block` to the start of the next block.
    fn advance(&self, ancestry: &Ancestry, block: u32, state: &mut LaneState) {
        let mut scratch = RowGeometry::default();
        for row in self.block_range(block) {
            let commit = self.order[row];
            let lit = ancestry.contains_row(u32::try_from(row).unwrap_or(u32::MAX));
            state.step(commit, self.index.parents(commit), lit, &mut scratch);
        }
    }

    fn block_range(&self, block: u32) -> std::ops::Range<usize> {
        let start = block as usize * BLOCK_ROWS as usize;
        start..(start + BLOCK_ROWS as usize).min(self.order.len())
    }

    /// Lays out the rows of `block` from `state`, leaving `state` at the start of the next one.
    fn replay(&self, ancestry: &Ancestry, block: u32, state: &mut LaneState) -> Vec<RowGeometry> {
        self.block_range(block)
            .map(|row| {
                let commit = self.order[row];
                let lit = ancestry.contains_row(u32::try_from(row).unwrap_or(u32::MAX));
                let mut geometry = RowGeometry::default();
                state.step(commit, self.index.parents(commit), lit, &mut geometry);
                geometry
            })
            .collect()
    }
}
